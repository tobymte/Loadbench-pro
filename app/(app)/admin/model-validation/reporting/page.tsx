import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { listAdapters } from '@/lib/ballistics/modelAdapter';
import { describeUnavailability, safeWithWorkspace } from '@/lib/db/safeLoad';
import { ReportingExportControls } from './ReportingExportControls';

export const dynamic = 'force-dynamic';

type RunSummary = {
  totalCases?: number;
  completedCases?: number;
  rejectedByGuardrail?: number;
  meanVelocityDeltaFps?: number | null;
  meanVelocityDeltaPct?: number | null;
};

function safeParseJson<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error.';
  }
}

export default async function ModelValidationReportingPage() {
  const admin = await getAdminContext();

  if (!admin.isAdmin) {
    return (
      <>
        <Topbar
          title="Admin · Model validation reporting"
          actions={<Badge tone="danger">Unauthorized</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <Card>
            <CardHeader
              title="Admin access required"
              description="Reporting is admin-only. Pressure prediction remains disabled regardless of access state."
            />
            <CardBody>
              <p className="text-[13px] text-text-muted">
                {admin.reason ?? 'You are not authorized to view this page.'}
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  let ctx: Awaited<ReturnType<typeof getWorkspaceContext>> | null = null;
  let workspaceError: string | null = null;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    workspaceError = describeError(e);
  }

  const result = ctx
    ? await safeWithWorkspace(async ({ workspaceId, prisma }) => {
        const [datasets, runs, cases] = await Promise.all([
          prisma.modelValidationDataset.findMany({
            where: { workspaceId },
            orderBy: { updatedAt: 'desc' },
            include: { _count: { select: { cases: true, runs: true } } },
          }),
          prisma.modelValidationRun.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
              id: true,
              datasetId: true,
              adapterName: true,
              adapterVersion: true,
              status: true,
              pressurePredictionStatus: true,
              summaryJson: true,
              rejectedForbiddenKeysJson: true,
              createdAt: true,
            },
          }),
          prisma.modelValidationCase.findMany({
            where: { workspaceId },
            select: {
              id: true,
              datasetId: true,
              chargeGr: true,
              cartridgeOalIn: true,
              referenceVelocityFps: true,
              bulletWeightGr: true,
              barrelLengthIn: true,
            },
          }),
        ]);
        return { datasets, runs, cases };
      })
    : null;

  if (!result || !result.ok) {
    const reason = result ? result.reason : null;
    return (
      <>
        <Topbar
          title="Admin · Model validation reporting"
          actions={<Badge tone="warning">Setup required</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <Card>
            <CardHeader
              title="Reporting unavailable"
              description="Reporting is non-operational by design — it surfaces validation harness telemetry only."
            />
            <CardBody>
              <p className="text-[13px] text-text-muted">
                {reason
                  ? describeUnavailability(reason)
                  : workspaceError ?? 'Workspace context not available.'}{' '}
                Pressure prediction remains disabled regardless of setup state.
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const { datasets, runs, cases } = result.data;
  const adapters = listAdapters();

  const datasetById = new Map(datasets.map((d) => [d.id, d]));

  const runsByStatus: Record<string, number> = {};
  for (const r of runs) {
    runsByStatus[r.status] = (runsByStatus[r.status] ?? 0) + 1;
  }

  const adapterStats = new Map<
    string,
    { name: string; runs: number; guardrailRejections: number; mostRecent: Date | null }
  >();
  for (const r of runs) {
    const key = `${r.adapterName}@${r.adapterVersion ?? '-'}`;
    const stat = adapterStats.get(key) ?? {
      name: key,
      runs: 0,
      guardrailRejections: 0,
      mostRecent: null,
    };
    stat.runs += 1;
    if (r.status === 'REJECTED_BY_GUARDRAIL') stat.guardrailRejections += 1;
    if (!stat.mostRecent || r.createdAt > stat.mostRecent) stat.mostRecent = r.createdAt;
    adapterStats.set(key, stat);
  }

  let totalCases = 0;
  let totalCompleted = 0;
  let totalRejected = 0;
  const deltaValues: number[] = [];
  for (const r of runs) {
    const sum = safeParseJson<RunSummary>(r.summaryJson);
    if (sum?.totalCases != null) totalCases += sum.totalCases;
    if (sum?.completedCases != null) totalCompleted += sum.completedCases;
    if (sum?.rejectedByGuardrail != null) totalRejected += sum.rejectedByGuardrail;
    if (sum?.meanVelocityDeltaFps != null) deltaValues.push(sum.meanVelocityDeltaFps);
  }
  const overallMeanDelta =
    deltaValues.length > 0
      ? deltaValues.reduce((a, b) => a + b, 0) / deltaValues.length
      : null;

  const completenessByDataset = datasets.map((d) => {
    const dsCases = cases.filter((c) => c.datasetId === d.id);
    if (dsCases.length === 0) {
      return {
        id: d.id,
        name: d.name,
        cases: 0,
        completenessPct: 0,
      };
    }
    let totalCells = 0;
    let filled = 0;
    for (const c of dsCases) {
      const cells = [
        c.chargeGr,
        c.cartridgeOalIn,
        c.referenceVelocityFps,
        c.bulletWeightGr,
        c.barrelLengthIn,
      ];
      totalCells += cells.length;
      filled += cells.filter((v) => v != null).length;
    }
    return {
      id: d.id,
      name: d.name,
      cases: dsCases.length,
      completenessPct: totalCells === 0 ? 0 : Math.round((filled / totalCells) * 100),
    };
  });

  const guardrailKeys = new Set<string>();
  for (const r of runs) {
    const keys = safeParseJson<string[]>(r.rejectedForbiddenKeysJson);
    if (Array.isArray(keys)) keys.forEach((k) => guardrailKeys.add(k));
  }

  const exportSummary = {
    generatedAt: new Date().toISOString(),
    workspaceId: ctx!.workspaceId,
    datasets: datasets.length,
    runs: runs.length,
    runsByStatus,
    adapters: Array.from(adapterStats.values()),
    aggregateCases: { totalCases, totalCompleted, totalRejected, overallMeanDelta },
    completenessByDataset,
    guardrailKeysObserved: Array.from(guardrailKeys),
  };

  return (
    <>
      <Topbar
        title="Admin · Model validation reporting"
        actions={<Badge tone="accent">Operator</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/admin/model-validation', label: 'Model validation' },
            { label: 'Reporting' },
          ]}
        />

        <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text">
          <strong className="font-semibold">
            Reporting only — no pressure prediction.
          </strong>{' '}
          Every metric on this page is descriptive of harness inputs and
          governance state. No PSI, peak pressure, charge advice, or
          safe/unsafe verdict is rendered here or anywhere else.
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Datasets" value={datasets.length} />
          <Stat label="Runs" value={runs.length} />
          <Stat label="Cases (across runs)" value={totalCases} />
          <Stat
            label="Mean velocity Δ (fps)"
            value={
              overallMeanDelta != null
                ? overallMeanDelta.toFixed(1)
                : '—'
            }
          />
        </div>

        <Card>
          <CardHeader
            title="Adapter status"
            description="Adapters are code-only. Every adapter still ships with pressure prediction disabled."
          />
          <CardBody>
            <table className="w-full text-[12px]">
              <thead className="text-left text-text-faint">
                <tr>
                  <th className="py-1 pr-3 font-medium">Adapter</th>
                  <th className="py-1 pr-3 font-medium">Governance</th>
                  <th className="py-1 pr-3 font-medium">Runs</th>
                  <th className="py-1 pr-3 font-medium">Guardrail rejections</th>
                  <th className="py-1 pr-3 font-medium">Most recent run</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {adapters.map((a) => {
                  const stat = Array.from(adapterStats.values()).find((s) =>
                    s.name.startsWith(a.name + '@'),
                  );
                  return (
                    <tr key={a.name} className="border-t border-border align-top">
                      <td className="py-1.5 pr-3">
                        <code>{a.name}</code>
                        <span className="ml-1 text-text-muted">@{a.version}</span>
                      </td>
                      <td className="py-1.5 pr-3">
                        <Badge tone={a.governanceStatus === 'disabled' ? 'danger' : 'warning'}>
                          {a.governanceStatus}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-3">{stat?.runs ?? 0}</td>
                      <td className="py-1.5 pr-3">{stat?.guardrailRejections ?? 0}</td>
                      <td className="py-1.5 pr-3 text-text-muted">
                        {stat?.mostRecent ? stat.mostRecent.toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Run history"
            description="Most recent 100 runs. Status counts reflect harness completion and guardrail behavior."
          />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {Object.entries(runsByStatus).map(([s, n]) => (
                <Stat key={s} label={s} value={n} small />
              ))}
              {Object.keys(runsByStatus).length === 0 && (
                <p className="text-[12px] text-text-muted col-span-full">
                  No runs recorded yet.
                </p>
              )}
            </div>
            {runs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-text-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Run</th>
                      <th className="py-1 pr-3 font-medium">Dataset</th>
                      <th className="py-1 pr-3 font-medium">Adapter</th>
                      <th className="py-1 pr-3 font-medium">Status</th>
                      <th className="py-1 pr-3 font-medium">Pressure</th>
                      <th className="py-1 pr-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {runs.slice(0, 25).map((r) => (
                      <tr key={r.id} className="border-t border-border align-top">
                        <td className="py-1.5 pr-3 font-mono text-[11px]">
                          {r.id.slice(-8)}
                        </td>
                        <td className="py-1.5 pr-3">
                          <Link
                            href={`/admin/model-validation/${r.datasetId}`}
                            className="text-accent hover:text-accent-hover"
                          >
                            {datasetById.get(r.datasetId)?.name ?? r.datasetId.slice(-6)}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3">
                          <code>{r.adapterName}</code>
                        </td>
                        <td className="py-1.5 pr-3">
                          <Badge
                            tone={
                              r.status === 'REJECTED_BY_GUARDRAIL'
                                ? 'danger'
                                : r.status === 'ERRORED'
                                  ? 'danger'
                                  : r.status === 'COMPLETED_NON_OPERATIONAL'
                                    ? 'success'
                                    : 'neutral'
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-1.5 pr-3 text-text-muted">
                          <code>{r.pressurePredictionStatus}</code>
                        </td>
                        <td className="py-1.5 pr-3 text-text-muted">
                          {r.createdAt.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {runs.length > 25 && (
                  <p className="text-[11px] text-text-faint mt-2">
                    Showing 25 of {runs.length} runs.
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Dataset coverage & completeness"
            description="Completeness is the percentage of populated transcription fields across a dataset's cases. Driver only — not a quality verdict."
          />
          <CardBody>
            {completenessByDataset.length === 0 ? (
              <p className="text-[12px] text-text-muted">No datasets yet.</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="text-left text-text-faint">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Dataset</th>
                    <th className="py-1 pr-3 font-medium">Cases</th>
                    <th className="py-1 pr-3 font-medium">Completeness</th>
                  </tr>
                </thead>
                <tbody className="text-text">
                  {completenessByDataset.map((d) => (
                    <tr key={d.id} className="border-t border-border align-top">
                      <td className="py-1.5 pr-3">
                        <Link
                          href={`/admin/model-validation/${d.id}`}
                          className="text-accent hover:text-accent-hover"
                        >
                          {d.name}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3">{d.cases}</td>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 rounded bg-bg-alt overflow-hidden">
                            <div
                              className="h-full bg-accent"
                              style={{ width: `${d.completenessPct}%` }}
                            />
                          </div>
                          <span className="tabular-nums">{d.completenessPct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        {guardrailKeys.size > 0 && (
          <Card>
            <CardHeader
              title="Guardrail-rejected keys observed"
              description="Any forbidden output key the guardrail has rejected across runs in this workspace. Useful for auditing adapter behaviour."
            />
            <CardBody>
              <ul className="text-[12px] text-text-muted space-y-0.5">
                {Array.from(guardrailKeys).sort().map((k) => (
                  <li key={k}>
                    <code className="text-danger">{k}</code>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Export summary"
            description="Copy the JSON summary or download as a file. Useful for governance review minutes."
          />
          <CardBody>
            <ReportingExportControls summary={exportSummary} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-surface px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </div>
      <div
        className={
          'mt-1 ' +
          (small ? 'text-base font-medium' : 'text-2xl font-semibold') +
          ' tabular-nums text-text'
        }
      >
        {value}
      </div>
    </div>
  );
}
