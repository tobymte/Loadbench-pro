import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  COVERAGE_LABEL_DESCRIPTION,
  SIMULATION_STATUS_LABEL,
  parseSimulationJson,
  type SimulationInputsSnapshot,
  type SimulationMetrics,
  type SimulationRunStatus,
} from '@/lib/validation/simulationRun';

export const dynamic = 'force-dynamic';

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

function fmtFps(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)} fps`;
}

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

function fmtSignedFps(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} fps`;
}

function fmtSignedPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtBool(v: boolean | null | undefined): string {
  if (v == null) return '—';
  return v ? 'Yes' : 'No';
}

export default async function SimulationRunDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await getWorkspaceContext();

  const run = await prisma.simulationRun.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: {
      modelVersion: { select: { id: true, name: true, status: true } },
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
        select: {
          id: true,
          date: true,
          avgVelocityFps: true,
          esFps: true,
          sdFps: true,
          shotsFired: true,
        },
      },
      publishedRow: {
        select: {
          id: true,
          bulletName: true,
          powderName: true,
          chargeGr: true,
          velocityFps: true,
          pageLabel: true,
          status: true,
        },
      },
    },
  });

  if (!run) {
    notFound();
  }

  const status = run.status as SimulationRunStatus;
  const metrics = parseSimulationJson<SimulationMetrics>(run.metricsJson);
  const snapshot = parseSimulationJson<SimulationInputsSnapshot>(
    run.inputsSnapshotJson,
  );

  return (
    <>
      <Topbar
        title="Simulation run"
        actions={<Badge tone="warning">Validation-only</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div className="text-[12px]">
          <Link
            href="/simulation-sandbox"
            className="text-accent hover:text-accent-hover"
          >
            ← Back to simulation sandbox
          </Link>
        </div>

        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
          data-testid="simulation-detail-warning"
        >
          This detail view shows a previously recorded velocity-only comparison.
          The metrics here describe user-entered values only. No pressure was
          predicted, no charge was recommended, and no load is labelled safe
          or unsafe by this app.
        </div>

        <Card>
          <CardHeader
            title="Run overview"
            description="Identifiers, review state, and the placeholder model version this comparison was bound to."
            actions={
              <Badge tone={statusTone(status)}>
                {SIMULATION_STATUS_LABEL[status]}
              </Badge>
            }
          />
          <CardBody>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-[13px]">
              <div className="flex justify-between md:block">
                <dt className="text-text-muted">Run ID</dt>
                <dd
                  className="text-text font-mono text-[12px]"
                  data-testid="simulation-detail-id"
                >
                  {run.id}
                </dd>
              </div>
              <div className="flex justify-between md:block">
                <dt className="text-text-muted">Model version</dt>
                <dd className="text-text">
                  {run.modelVersion.name}{' '}
                  <span className="text-text-faint text-[11px]">
                    · {run.modelVersion.status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between md:block">
                <dt className="text-text-muted">Created</dt>
                <dd className="text-text">
                  {new Date(run.createdAt).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between md:block">
                <dt className="text-text-muted">Updated</dt>
                <dd className="text-text">
                  {new Date(run.updatedAt).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between md:block">
                <dt className="text-text-muted">Acknowledged</dt>
                <dd className="text-text">
                  {run.acknowledgedExperimental ? 'Yes' : 'No'}
                </dd>
              </div>
              <div className="flex justify-between md:block">
                <dt className="text-text-muted">Tolerance</dt>
                <dd className="text-text">
                  {[
                    run.toleranceFps != null ? `±${run.toleranceFps} fps` : null,
                    run.tolerancePct != null ? `±${run.tolerancePct}%` : null,
                  ]
                    .filter(Boolean)
                    .join(' / ') || '—'}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Linked records"
            description="Entities at the time this run was saved. Inputs snapshot below preserves the values as they were."
          />
          <CardBody>
            <ul className="space-y-2 text-[13px]" data-testid="simulation-detail-links">
              <li>
                <span className="text-text-muted">Load:</span>{' '}
                {run.load ? (
                  <Link
                    href={`/loads/${run.load.id}`}
                    className="text-accent hover:text-accent-hover"
                  >
                    {run.load.name}
                  </Link>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </li>
              <li>
                <span className="text-text-muted">Validation record:</span>{' '}
                {run.validationRecord ? (
                  <span className="text-text">
                    {run.validationRecord.referenceLabel}
                  </span>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </li>
              <li>
                <span className="text-text-muted">Verified published row:</span>{' '}
                {run.publishedRow ? (
                  <span className="text-text">
                    {[
                      run.publishedRow.bulletName,
                      run.publishedRow.powderName,
                      run.publishedRow.chargeGr != null
                        ? `${run.publishedRow.chargeGr}gr`
                        : null,
                      run.publishedRow.velocityFps != null
                        ? `${run.publishedRow.velocityFps.toFixed(0)} fps`
                        : null,
                      run.publishedRow.pageLabel
                        ? `p. ${run.publishedRow.pageLabel}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '(unlabeled row)'}
                  </span>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </li>
              <li>
                <span className="text-text-muted">Range / chrono session:</span>{' '}
                {run.rangeSession ? (
                  <span className="text-text">
                    {new Date(run.rangeSession.date).toLocaleDateString()} · avg{' '}
                    {fmtFps(run.rangeSession.avgVelocityFps, 0)}
                  </span>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Comparison metrics"
            description="Velocity-only descriptive metrics computed from the inputs. Not a pressure prediction. Not a safe/unsafe label."
            actions={
              metrics?.coverage ? (
                <Badge
                  tone={
                    metrics.coverage === 'velocity-comparison-complete'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {metrics.coverage}
                </Badge>
              ) : null
            }
          />
          <CardBody>
            {metrics ? (
              <>
                <dl
                  className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6 text-[13px]"
                  data-testid="simulation-detail-metrics"
                >
                  <div>
                    <dt className="text-text-muted">Reference velocity</dt>
                    <dd className="text-text">{fmtFps(metrics.referenceFps)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Observed velocity</dt>
                    <dd className="text-text">{fmtFps(metrics.observedFps)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Δ fps</dt>
                    <dd className="text-text">
                      {fmtSignedFps(metrics.deltaFps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Δ %</dt>
                    <dd className="text-text">
                      {fmtSignedPct(metrics.deltaPct)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">|Δ| fps</dt>
                    <dd className="text-text">{fmtFps(metrics.absDeltaFps)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">|Δ| %</dt>
                    <dd className="text-text">{fmtPct(metrics.absDeltaPct)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Residual vs reference</dt>
                    <dd className="text-text">
                      {fmtSignedFps(metrics.residualFps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Within tolerance (fps)</dt>
                    <dd className="text-text">
                      {fmtBool(metrics.withinToleranceFps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Within tolerance (%)</dt>
                    <dd className="text-text">
                      {fmtBool(metrics.withinTolerancePct)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Within tolerance (combined)</dt>
                    <dd className="text-text">
                      {fmtBool(metrics.withinToleranceCombined)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Session ES</dt>
                    <dd className="text-text">
                      {fmtFps(metrics.rangeSessionEsFps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Session SD</dt>
                    <dd className="text-text">
                      {fmtFps(metrics.rangeSessionSdFps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Session shots</dt>
                    <dd className="text-text">
                      {metrics.rangeSessionShots ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Data completeness</dt>
                    <dd className="text-text">
                      {(metrics.completeness * 100).toFixed(0)}%
                    </dd>
                  </div>
                </dl>
                <p
                  className="mt-3 text-[11px] text-text-faint"
                  data-testid="simulation-detail-coverage"
                >
                  Coverage: {COVERAGE_LABEL_DESCRIPTION[metrics.coverage]}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-text-faint">
                No metrics blob stored for this run. The Δ fields shown on the
                run itself are: Δ fps {fmtSignedFps(run.velocityDeltaFps)} · Δ %{' '}
                {fmtSignedPct(run.velocityDeltaPct)}.
              </p>
            )}
            <p className="mt-3 text-[11px] text-text-faint">
              No predicted pressure value is shown here because no pressure
              value is computed. Reference pressure on a linked validation
              record, if any, is user-entered input only.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Inputs snapshot"
            description="The inputs as they were when this run was saved. Stored alongside the run so the historical record stays interpretable if entities are later renamed or unlinked."
          />
          <CardBody>
            {snapshot ? (
              <pre
                className="text-[11px] text-text-muted bg-bg-alt border border-border rounded-md p-3 overflow-x-auto"
                data-testid="simulation-detail-snapshot"
              >
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            ) : (
              <p className="text-[12px] text-text-faint">
                No inputs snapshot stored for this run (older record before
                snapshot persistence was added).
              </p>
            )}
          </CardBody>
        </Card>

        {(run.notes || run.reviewerNotes) && (
          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              {run.notes && (
                <div className="mb-3">
                  <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">
                    Notes
                  </div>
                  <div
                    className="text-[13px] text-text whitespace-pre-wrap"
                    data-testid="simulation-detail-notes"
                  >
                    {run.notes}
                  </div>
                </div>
              )}
              {run.reviewerNotes && (
                <div>
                  <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">
                    Reviewer notes
                  </div>
                  <div
                    className="text-[13px] text-text whitespace-pre-wrap"
                    data-testid="simulation-detail-reviewer-notes"
                  >
                    {run.reviewerNotes}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
