import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { FEATURE_KEYS, getEntitlement } from '@/lib/billing/entitlements';
import {
  PRESSURE_ENGINE_STATUS_LABEL,
  PRESSURE_PREDICTION_DISABLED_REASON,
  stripForbiddenKeys,
  type EngineInputsSnapshot,
  type EngineRunOutputs,
  type PressureEngineRunStatus,
} from '@/lib/validation/pressureEngine';

export const dynamic = 'force-dynamic';

// Pressure engine — Run detail page.
//
// SAFETY: Shows ONLY allowed, non-prescriptive outputs for a single
// PressureEngineRun:
//   * completeness, missing fields, source coverage
//   * input-consistency warnings (descriptive)
//   * reference-vs-observed velocity delta (fps + %)
//   * guardrail status + pressurePredictionStatus = 'disabled'
// The outputs JSON is also defensively re-stripped of forbidden keys
// before rendering, so a tampered row cannot leak a PSI value.

function statusTone(
  s: PressureEngineRunStatus,
): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (s) {
    case 'DRAFT':
      return 'neutral';
    case 'INPUT_INCOMPLETE':
      return 'warning';
    case 'COMPLETED_NON_OPERATIONAL':
      return 'success';
    case 'REJECTED_BY_GUARDRAIL':
      return 'danger';
    case 'ARCHIVED':
      return 'neutral';
  }
}

function SetupNotice({ message }: { message: string }) {
  return (
    <>
      <Topbar
        title="Pressure engine · Run detail"
        actions={<Badge tone="warning">Setup required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2">
          <p>
            <strong className="font-semibold">
              Pressure engine workspace is not ready yet.
            </strong>
          </p>
          <p className="text-[12px] text-text-muted">{message}</p>
          <p className="text-[12px]">
            <Link
              href="/pressure-engine"
              className="text-accent hover:text-accent-hover"
            >
              Back to pressure engine
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error.';
  }
}

function parseOutputs(raw: string | null): Partial<EngineRunOutputs> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<EngineRunOutputs>;
    return stripForbiddenKeys(value);
  } catch {
    return null;
  }
}

function parseInputs(
  raw: string | null,
): Partial<EngineInputsSnapshot> | null {
  if (!raw) return null;
  try {
    return stripForbiddenKeys(JSON.parse(raw) as Partial<EngineInputsSnapshot>);
  } catch {
    return null;
  }
}

export default async function PressureEngineRunDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let ctx: Awaited<ReturnType<typeof getWorkspaceContext>>;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    return <SetupNotice message={describeError(e)} />;
  }

  let entitlement: Awaited<ReturnType<typeof getEntitlement>>;
  try {
    entitlement = await getEntitlement(
      ctx.workspaceId,
      FEATURE_KEYS.PRESSURE_MODELING,
    );
  } catch (e) {
    return <SetupNotice message={describeError(e)} />;
  }

  if (!entitlement.hasAccess) {
    return (
      <>
        <Topbar
          title="Pressure engine · Run detail"
          actions={<Badge tone="accent">Premium</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
            data-testid="pressure-engine-detail-locked"
          >
            <strong className="font-semibold">
              Premium access required.
            </strong>{' '}
            Pressure prediction stays disabled regardless of access.{' '}
            <Link
              href="/pressure-engine"
              className="text-accent hover:text-accent-hover"
            >
              Back to pressure engine
            </Link>
            .
          </div>
        </div>
      </>
    );
  }

  let run: Awaited<ReturnType<typeof loadRun>>;
  try {
    run = await loadRun(ctx.workspaceId, params.id);
  } catch (e) {
    return <SetupNotice message={describeError(e)} />;
  }
  if (!run) notFound();

  const outputs = parseOutputs(run.outputsJson);
  const inputs = parseInputs(run.inputsSnapshotJson);
  const status = run.status as PressureEngineRunStatus;
  const sourceCoverage = outputs?.sourceCoverage ?? null;

  return (
    <>
      <Topbar
        title="Pressure engine · Run detail"
        actions={<Badge tone={statusTone(status)}>
          {PRESSURE_ENGINE_STATUS_LABEL[status]}
        </Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
          data-testid="pressure-engine-detail-warning"
        >
          <p>
            <strong className="font-semibold">
              Pressure prediction is disabled.
            </strong>{' '}
            This page shows only non-prescriptive bookkeeping for one engine
            run:{' '}
            <code className="text-accent">
              pressurePredictionStatus = &quot;{run.pressurePredictionStatus}
              &quot;
            </code>
            . No PSI, peak pressure, charge recommendation, or safe/unsafe
            verdict appears below.
          </p>
          <p className="text-[12px]">
            <Link
              href="/pressure-engine"
              className="text-accent hover:text-accent-hover"
            >
              ← Back to pressure engine
            </Link>{' '}
            ·{' '}
            <Link
              href="/pressure-engine/new"
              className="text-accent hover:text-accent-hover"
            >
              Build another run
            </Link>
          </p>
        </div>

        <Card data-testid="pressure-engine-detail-summary">
          <CardHeader
            title="Run summary"
            description="Audit-only summary of this engine run. No pressure prediction is computed or displayed."
          />
          <CardBody>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
              <FieldDD label="Run ID" value={<code>{run.id}</code>} />
              <FieldDD
                label="Created"
                value={run.createdAt.toLocaleString()}
              />
              <FieldDD
                label="Status"
                value={
                  <Badge tone={statusTone(status)}>
                    {PRESSURE_ENGINE_STATUS_LABEL[status]}
                  </Badge>
                }
              />
              <FieldDD
                label="Prediction status"
                value={
                  <code className="text-accent">
                    {run.pressurePredictionStatus}
                  </code>
                }
              />
              <FieldDD
                label="Model version"
                value={run.modelVersion?.name ?? '—'}
              />
              <FieldDD label="Load" value={run.load?.name ?? '—'} />
              <FieldDD
                label="Range session"
                value={
                  run.rangeSession?.date
                    ? run.rangeSession.date.toLocaleDateString()
                    : '—'
                }
              />
              <FieldDD
                label="Validation record"
                value={run.validationRecord?.referenceLabel ?? '—'}
              />
            </dl>
          </CardBody>
        </Card>

        <Card data-testid="pressure-engine-detail-outputs">
          <CardHeader
            title="Allowed outputs"
            description="Completeness, missing-field list, velocity-only delta, source coverage, warnings, and the disabled prediction status. Nothing else."
            actions={<Badge tone="success">Non-prescriptive</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12px]">
              <FieldDD
                label="Data completeness"
                value={
                  outputs?.dataCompleteness != null
                    ? `${(outputs.dataCompleteness * 100).toFixed(0)}%`
                    : '—'
                }
              />
              <FieldDD
                label="Velocity Δ"
                value={
                  run.velocityDeltaFps != null
                    ? `${run.velocityDeltaFps >= 0 ? '+' : ''}${run.velocityDeltaFps.toFixed(1)} fps`
                    : '—'
                }
              />
              <FieldDD
                label="Velocity Δ %"
                value={
                  run.velocityDeltaPct != null
                    ? `${run.velocityDeltaPct >= 0 ? '+' : ''}${run.velocityDeltaPct.toFixed(2)}%`
                    : '—'
                }
              />
              <FieldDD
                label="Reference velocity"
                value={
                  outputs?.referenceVelocityFps != null
                    ? `${outputs.referenceVelocityFps.toFixed(0)} fps`
                    : '—'
                }
              />
              <FieldDD
                label="Observed velocity"
                value={
                  outputs?.observedVelocityFps != null
                    ? `${outputs.observedVelocityFps.toFixed(0)} fps`
                    : '—'
                }
              />
              <FieldDD
                label="Guardrail status"
                value={
                  status === 'REJECTED_BY_GUARDRAIL' ? (
                    <Badge tone="danger">Rejected</Badge>
                  ) : (
                    <Badge tone="success">Enforced</Badge>
                  )
                }
              />
            </div>

            {sourceCoverage && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
                  Source coverage
                </div>
                <div
                  className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]"
                  data-testid="pressure-engine-detail-source-coverage"
                >
                  <CoverageDot
                    on={!!sourceCoverage.hasLinkedLoad}
                    label="Linked load"
                  />
                  <CoverageDot
                    on={!!sourceCoverage.hasModelVersion}
                    label="Model version"
                  />
                  <CoverageDot
                    on={!!sourceCoverage.hasRangeSession}
                    label="Range session"
                  />
                  <CoverageDot
                    on={!!sourceCoverage.hasReferenceVelocity}
                    label="Reference velocity"
                  />
                  <CoverageDot
                    on={!!sourceCoverage.hasObservedVelocity}
                    label="Observed velocity"
                  />
                  <CoverageDot
                    on={!!sourceCoverage.hasReferencePressure}
                    label="Reference pressure (user-entered)"
                  />
                </div>
              </div>
            )}

            {outputs?.missingFields && outputs.missingFields.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
                  Missing fields
                </div>
                <ul
                  className="flex flex-wrap gap-1"
                  data-testid="pressure-engine-detail-missing-fields"
                >
                  {outputs.missingFields.map((f) => (
                    <li key={f}>
                      <Badge tone="warning">{f}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {outputs?.inputConsistencyWarnings &&
              outputs.inputConsistencyWarnings.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
                    Input-consistency warnings
                  </div>
                  <ul
                    className="list-disc pl-5 text-text-muted text-[12px] space-y-1"
                    data-testid="pressure-engine-detail-warnings"
                  >
                    {outputs.inputConsistencyWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

            {run.notes && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
                  Notes
                </div>
                <p className="text-[12px] text-text-muted whitespace-pre-wrap">
                  {run.notes}
                </p>
              </div>
            )}

            <p className="text-[11px] text-text-faint leading-relaxed">
              {PRESSURE_PREDICTION_DISABLED_REASON}
            </p>
          </CardBody>
        </Card>

        {inputs && (
          <Card data-testid="pressure-engine-detail-inputs-snapshot">
            <CardHeader
              title="Input snapshot"
              description="Read-only snapshot of the records selected when this run was saved. Solver-input counts reflect workspace totals at run time."
            />
            <CardBody className="space-y-3 text-[12px]">
              {inputs.solverInputCounts && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
                    Solver-input counts (workspace at run time)
                  </div>
                  <ul className="flex flex-wrap gap-3 text-text-muted">
                    <li>
                      Case capacity:{' '}
                      {inputs.solverInputCounts.caseCapacity ?? 0}
                    </li>
                    <li>
                      Bullet dimensions:{' '}
                      {inputs.solverInputCounts.bulletDimensions ?? 0}
                    </li>
                    <li>
                      Powder metadata:{' '}
                      {inputs.solverInputCounts.powderMetadata ?? 0}
                    </li>
                    <li>
                      Barrel geometry:{' '}
                      {inputs.solverInputCounts.barrelGeometry ?? 0}
                    </li>
                    <li>
                      Chrono calibration:{' '}
                      {inputs.solverInputCounts.chronoCalibration ?? 0}
                    </li>
                  </ul>
                </div>
              )}
              <pre
                className="overflow-x-auto rounded-md border border-border bg-bg-inset px-3 py-2 text-[11px] text-text-muted"
                data-testid="pressure-engine-detail-inputs-json"
              >
                {JSON.stringify(inputs, null, 2)}
              </pre>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

async function loadRun(workspaceId: string, id: string) {
  return prisma.pressureEngineRun.findFirst({
    where: { id, workspaceId },
    include: {
      modelVersion: {
        select: { id: true, name: true, status: true },
      },
      load: { select: { id: true, name: true } },
      rangeSession: {
        select: { id: true, date: true, avgVelocityFps: true },
      },
      validationRecord: {
        select: { id: true, referenceLabel: true },
      },
    },
  });
}

function FieldDD({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-text-faint">
        {label}
      </dt>
      <dd className="text-text mt-0.5">{value}</dd>
    </div>
  );
}

function CoverageDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span
        className={
          on
            ? 'inline-block h-1.5 w-1.5 rounded-full bg-success'
            : 'inline-block h-1.5 w-1.5 rounded-full bg-border'
        }
      />
      <span className={on ? 'text-text' : 'text-text-faint'}>{label}</span>
    </span>
  );
}
