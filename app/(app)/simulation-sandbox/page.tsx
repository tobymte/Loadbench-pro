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
  type SimulationFormRangeSession,
  type SimulationFormValidationRecord,
} from '@/components/forms/SimulationRunForm';
import {
  SIMULATION_STATUS_LABEL,
  type SimulationRunStatus,
} from '@/lib/validation/simulationRun';

export const dynamic = 'force-dynamic';

// Non-operational validation sandbox.
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

export default async function SimulationSandboxPage() {
  const ctx = await getWorkspaceContext();

  const [modelVersions, loads, validationRecords, rangeSessions, simulationRuns] =
    await Promise.all([
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
          load: { select: { name: true } },
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
      loadName: s.load?.name ?? null,
    }),
  );

  const checklist = solverReadinessChecklist();

  return (
    <>
      <Topbar
        title="Simulation sandbox"
        actions={<Badge tone="warning">Non-operational</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
          data-testid="simulation-sandbox-warning"
        >
          <strong className="font-semibold">
            Non-operational validation sandbox — no pressure predictions or load
            advice.
          </strong>{' '}
          This page compares user-entered reference and observed chronograph
          values against placeholder model versions. It does not compute
          pressure, recommend a charge, suggest a powder substitution, or label
          any load as safe or unsafe. Pressure predictions and load advice are
          disabled until licensed reference data, a validated model,
          independent expert review, and legal / risk controls are all in
          place. See the{' '}
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
            description="Pick a placeholder model version and link a reference / validation record and / or a chrono session. Tolerance is velocity-only; this sandbox does not suggest charge changes."
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
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent simulation runs"
            description="Status of each comparison. Predicted pressure values are intentionally not displayed — none are computed."
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
                      <th>Load</th>
                      <th>Reference</th>
                      <th>Δ fps</th>
                      <th>Δ %</th>
                      <th>Tolerance</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationRuns.map((r) => (
                      <tr key={r.id} data-testid={`simulation-row-${r.id}`}>
                        <td className="text-text">{r.modelVersion.name}</td>
                        <td>
                          <Badge tone={statusTone(r.status as SimulationRunStatus)}>
                            {SIMULATION_STATUS_LABEL[r.status as SimulationRunStatus]}
                          </Badge>
                        </td>
                        <td className="text-text-muted">
                          {r.load?.name ?? '—'}
                        </td>
                        <td className="text-text-muted">
                          {r.validationRecord?.referenceLabel ?? '—'}
                        </td>
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
                      </tr>
                    ))}
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
