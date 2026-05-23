import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { solverReadinessChecklist } from '@/lib/analysis/pressureReadiness';
import {
  SimulationRunForm,
  type SimulationFormLoad,
  type SimulationFormModelVersion,
  type SimulationFormPublishedRow,
  type SimulationFormRangeSession,
  type SimulationFormValidationRecord,
} from '@/components/forms/SimulationRunForm';
import {
  SIMULATION_STATUS_LABEL,
  type SimulationRunStatus,
} from '@/lib/validation/simulationRun';

export const dynamic = 'force-dynamic';

// Operational validation sandbox.
// This page compares user-entered reference / chrono observations against
// placeholder model versions. It does NOT:
//   - compute or display predicted pressure values
//   - recommend powder charges
//   - propose powder substitutions
//   - mark any load as safe or unsafe
// The fields surfaced here are review-state bookkeeping and velocity-delta
// comparison only. No formula in this app derives a pressure prediction
// from these records.

function statusTone(
  s: SimulationRunStatus,
): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (s) {
    case 'DRAFT':
      return 'neutral';
    case 'INPUT_INCOMPLETE':
      return 'warning';
    case 'READY_FOR_EXPERT_REVIEW':
      return 'accent';
    case 'REFERENCE_MATCHED_WITHIN_TOLERANCE':
      return 'success';
    case 'NEEDS_INVESTIGATION':
      return 'warning';
    case 'REJECTED_BY_REVIEWER':
      return 'danger';
  }
}

function checklistTone(
  status: 'planned' | 'in-progress' | 'blocked' | 'complete',
): 'neutral' | 'accent' | 'success' | 'warning' {
  if (status === 'complete') return 'success';
  if (status === 'in-progress') return 'accent';
  if (status === 'blocked') return 'warning';
  return 'neutral';
}

function publishedRowLabel(row: {
  bulletName: string | null;
  powderName: string | null;
  bulletWeightGr: number | null;
  chargeGr: number | null;
  velocityFps: number | null;
  pageLabel: string | null;
}): string {
  const parts: string[] = [];
  if (row.bulletName) {
    parts.push(
      row.bulletWeightGr != null
        ? `${row.bulletName} ${row.bulletWeightGr}gr`
        : row.bulletName,
    );
  } else if (row.bulletWeightGr != null) {
    parts.push(`${row.bulletWeightGr}gr bullet`);
  }
  if (row.powderName) parts.push(row.powderName);
  if (row.chargeGr != null) parts.push(`${row.chargeGr}gr`);
  if (row.velocityFps != null) parts.push(`${row.velocityFps.toFixed(0)} fps`);
  if (row.pageLabel) parts.push(`p. ${row.pageLabel}`);
  return parts.length === 0 ? '(unlabeled row)' : parts.join(' · ');
}

export default async function SimulationSandboxPage() {
  const ctx = await getWorkspaceContext();

  const [
    modelVersions,
    loads,
    validationRecords,
    rangeSessions,
    publishedRows,
    simulationRuns,
  ] = await Promise.all([
    prisma.pressureModelVersion.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, status: true },
    }),
    prisma.load.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.pressureValidationRecord.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        referenceLabel: true,
        referenceVelocityFps: true,
        measuredVelocityFps: true,
        referencePressurePsi: true,
      },
    }),
    prisma.rangeSession.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { date: 'desc' },
      take: 200,
      select: {
        id: true,
        date: true,
        avgVelocityFps: true,
        esFps: true,
        sdFps: true,
        shotsFired: true,
        load: { select: { name: true } },
      },
    }),
    prisma.publishedLoadRowDraft.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        status: 'VERIFIED',
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        bulletName: true,
        powderName: true,
        bulletWeightGr: true,
        chargeGr: true,
        velocityFps: true,
        pageLabel: true,
      },
    }),
    prisma.simulationRun.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        modelVersion: { select: { id: true, name: true } },
        load: { select: { id: true, name: true } },
        validationRecord: {
          select: {
            id: true,
            referenceLabel: true,
            referenceVelocityFps: true,
            measuredVelocityFps: true,
            referencePressurePsi: true,
          },
        },
        rangeSession: {
          select: { id: true, date: true, avgVelocityFps: true },
        },
        publishedRow: {
          select: {
            id: true,
            bulletName: true,
            powderName: true,
            chargeGr: true,
            velocityFps: true,
            pageLabel: true,
          },
        },
      },
    }),
  ]);

  const formModelVersions: SimulationFormModelVersion[] = modelVersions.map(
    (m) => ({ id: m.id, name: m.name, status: m.status }),
  );
  const formLoads: SimulationFormLoad[] = loads;
  const formValidationRecords: SimulationFormValidationRecord[] =
    validationRecords;
  const formRangeSessions: SimulationFormRangeSession[] = rangeSessions.map(
    (s) => ({
      id: s.id,
      date: s.date.toISOString(),
      avgVelocityFps: s.avgVelocityFps,
      esFps: s.esFps,
      sdFps: s.sdFps,
      shotsFired: s.shotsFired,
      loadName: s.load?.name ?? null,
    }),
  );
  const formPublishedRows: SimulationFormPublishedRow[] = publishedRows.map(
    (r) => ({
      id: r.id,
      label: publishedRowLabel(r),
      velocityFps: r.velocityFps,
      chargeGr: r.chargeGr,
    }),
  );

  const checklist = solverReadinessChecklist();

  return (
    <>
      <Topbar
        title="Simulation sandbox"
        actions={<Badge tone="warning">Validation-only</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
          data-testid="simulation-sandbox-warning"
        >
          <strong className="font-semibold">
            Validation / comparison tool only — no pressure predictions or load
            advice.
          </strong>{' '}
          This page compares user-entered reference values (from verified
          published rows or validation records) against observed chronograph
          data using placeholder model versions. It does not compute pressure,
          recommend a charge, suggest a powder substitution, or label any load
          as safe or unsafe. Pressure predictions and load advice are disabled
          until licensed reference data, a validated model, independent expert
          review, and legal / risk controls are all in place. See the{' '}
          <Link href="/safety" className="text-accent hover:text-accent-hover">
            safety policy
          </Link>{' '}
          and the{' '}
          <Link
            href="/pressure-modeling"
            className="text-accent hover:text-accent-hover"
          >
            pressure modeling test bench
          </Link>
          .
        </div>

        <Card>
          <CardHeader
            title="Solver readiness checklist"
            description="Project-level gates that must be passed before any pressure solver could be considered for enablement. Documentation, not a toggle."
          />
          <CardBody>
            <ul
              className="space-y-3"
              data-testid="simulation-readiness-checklist"
            >
              {checklist.map((item) => (
                <li
                  key={item.key}
                  className="border-l-2 border-border pl-4 py-1"
                  data-testid={`simulation-readiness-${item.key}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">
                      {item.label}
                    </span>
                    <Badge tone={checklistTone(item.status)}>
                      {item.status}
                    </Badge>
                  </div>
                  {item.detail && (
                    <p className="mt-1 text-[12px] text-text-muted leading-relaxed">
                      {item.detail}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Record a comparison run"
            description="Pick a placeholder model version and link a reference (validation record or verified published row) and / or a chrono session. Tolerance is velocity-only; this sandbox does not suggest charge changes."
            actions={<Badge tone="warning">Acknowledgement required</Badge>}
          />
          <CardBody>
            {modelVersions.length === 0 ? (
              <p
                className="text-[12px] text-text-muted"
                data-testid="simulation-no-versions"
              >
                No placeholder model versions yet. Create one in the{' '}
                <Link
                  href="/pressure-modeling"
                  className="text-accent hover:text-accent-hover"
                >
                  pressure modeling test bench
                </Link>{' '}
                first.
              </p>
            ) : (
              <SimulationRunForm
                modelVersions={formModelVersions}
                loads={formLoads}
                validationRecords={formValidationRecords}
                rangeSessions={formRangeSessions}
                publishedRows={formPublishedRows}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent simulation runs"
            description="Click a row for the full inputs snapshot and computed comparison metrics. Predicted pressure values are intentionally not displayed — none are computed."
            actions={<Badge tone="neutral">Status only</Badge>}
          />
          <CardBody>
            {simulationRuns.length === 0 ? (
              <p
                className="text-[12px] text-text-muted"
                data-testid="simulation-runs-empty"
              >
                No simulation runs yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table data-testid="simulation-runs-table">
                  <thead>
                    <tr>
                      <th>Model version</th>
                      <th>Status</th>
                      <th>Reference</th>
                      <th>Δ fps</th>
                      <th>Δ %</th>
                      <th>Tolerance</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {simulationRuns.map((r) => {
                      const referenceLabel =
                        r.validationRecord?.referenceLabel ??
                        (r.publishedRow
                          ? `Published · ${r.publishedRow.bulletName ?? '—'}${r.publishedRow.pageLabel ? ` (p. ${r.publishedRow.pageLabel})` : ''}`
                          : '—');
                      return (
                        <tr key={r.id} data-testid={`simulation-row-${r.id}`}>
                          <td className="text-text">{r.modelVersion.name}</td>
                          <td>
                            <Badge tone={statusTone(r.status as SimulationRunStatus)}>
                              {SIMULATION_STATUS_LABEL[r.status as SimulationRunStatus]}
                            </Badge>
                          </td>
                          <td className="text-text-muted">{referenceLabel}</td>
                          <td className="text-text">
                            {r.velocityDeltaFps != null
                              ? `${r.velocityDeltaFps >= 0 ? '+' : ''}${r.velocityDeltaFps.toFixed(1)}`
                              : '—'}
                          </td>
                          <td className="text-text">
                            {r.velocityDeltaPct != null
                              ? `${r.velocityDeltaPct >= 0 ? '+' : ''}${r.velocityDeltaPct.toFixed(2)}%`
                              : '—'}
                          </td>
                          <td className="text-text-muted">
                            {formatTolerance(r.toleranceFps, r.tolerancePct)}
                          </td>
                          <td className="text-text-faint">
                            {new Date(r.updatedAt).toLocaleString()}
                          </td>
                          <td>
                            <Link
                              href={`/simulation-sandbox/${r.id}`}
                              className="text-accent hover:text-accent-hover text-[12px]"
                              data-testid={`simulation-row-detail-${r.id}`}
                            >
                              Detail →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-text-faint">
              Statuses describe review state only — never safety. The table
              intentionally omits any computed pressure value because no
              pressure value is computed.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              This sandbox is a structured review surface for velocity-delta
              comparisons against placeholder model versions. It does not
              predict pressure, recommend charges, propose powder substitutions,
              or certify any load. Until licensed reference data, an
              expert-validated model, documented variance bounds, independent
              expert review, and legal / risk controls are all in place, no
              pressure prediction or load advice will be produced by this
              application.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function formatTolerance(fps: number | null, pct: number | null): string {
  const parts: string[] = [];
  if (fps != null) parts.push(`±${fps} fps`);
  if (pct != null) parts.push(`±${pct}%`);
  return parts.length === 0 ? '—' : parts.join(' / ');
}
