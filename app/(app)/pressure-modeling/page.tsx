import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { getAdminContext } from '@/lib/auth/admin';
import { solverReadinessChecklist } from '@/lib/analysis/pressureReadiness';
import { PressureModelVersionForm } from '@/components/forms/PressureModelVersionForm';
import { PressureValidationRecordForm } from '@/components/forms/PressureValidationRecordForm';
import { LoadReadinessSelector } from '@/components/forms/LoadReadinessSelector';
import { PaywallNotice } from '@/components/billing/PaywallNotice';
import { FEATURE_KEYS, getEntitlement } from '@/lib/billing/entitlements';
import { isBigCommerceConfigured } from '@/lib/billing/bigcommerce';

export const dynamic = 'force-dynamic';

// Experimental validation workspace.
// This page is EXPLICITLY not a pressure predictor, not a charge recommender,
// and not a safety judge. It captures structured notes and reference data so
// that a future, expert-validated internal-ballistics model could one day be
// evaluated. No code path on this route computes pressure values, recommends
// charges, or marks any load as safe/unsafe.

type StatusKey =
  | 'DRAFT'
  | 'READY_FOR_EXPERT_REVIEW'
  | 'BLOCKED'
  | 'VALIDATED_REFERENCE'
  | 'REJECTED';

const STATUS_LABEL: Record<StatusKey, string> = {
  DRAFT: 'Draft',
  READY_FOR_EXPERT_REVIEW: 'Ready for expert review',
  BLOCKED: 'Blocked',
  VALIDATED_REFERENCE: 'Validated reference',
  REJECTED: 'Rejected',
};

function statusTone(
  s: StatusKey,
): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (s) {
    case 'DRAFT':
      return 'neutral';
    case 'READY_FOR_EXPERT_REVIEW':
      return 'accent';
    case 'BLOCKED':
      return 'warning';
    case 'VALIDATED_REFERENCE':
      return 'success';
    case 'REJECTED':
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

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error.';
  }
}

function SetupNotice({
  message,
  isAdmin,
}: {
  message: string;
  isAdmin: boolean;
}) {
  return (
    <>
      <Topbar
        title="Pressure modeling test bench"
        actions={<Badge tone="warning">Setup required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
          data-testid="pressure-modeling-setup-required"
        >
          <p>
            <strong className="font-semibold">
              Pressure modeling test bench is not ready yet.
            </strong>{' '}
            The experimental validation workspace could not be loaded.
          </p>
          <p className="text-[12px] text-text-muted">{message}</p>
          <p className="text-[12px] text-text-muted">
            Typical fixes: run{' '}
            <code className="text-accent">npx prisma migrate deploy</code> then{' '}
            <code className="text-accent">npx prisma generate</code>, and
            confirm <code className="text-accent">DATABASE_URL</code> is set.
            Nothing on this page computes pressure, recommends a charge, or
            marks any load as safe or unsafe regardless of setup state.
          </p>
          <p className="text-[12px] text-text-muted">
            See the{' '}
            <Link
              href="/safety"
              className="text-accent hover:text-accent-hover"
            >
              safety policy
            </Link>
            {isAdmin && (
              <>
                {' '}
                or visit{' '}
                <Link
                  href="/admin/entitlements"
                  className="text-accent hover:text-accent-hover"
                >
                  admin entitlements
                </Link>{' '}
                to manage manual access
              </>
            )}
            .
          </p>
        </div>
      </div>
    </>
  );
}

function UnauthenticatedNotice() {
  return (
    <>
      <Topbar
        title="Pressure modeling test bench"
        actions={<Badge tone="warning">Sign-in required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card data-testid="pressure-modeling-unauthenticated">
          <CardHeader
            title="Sign in to use the pressure modeling test bench"
            description="The experimental validation workspace is scoped to a signed-in workspace. Pressure prediction, charge advice, and safe/unsafe verdicts are not provided here regardless of sign-in state."
          />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/sign-in"
                className="inline-flex items-center rounded border border-accent bg-accent px-3 py-1.5 text-[13px] text-bg hover:bg-accent-hover"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center rounded border border-border bg-bg px-3 py-1.5 text-[13px] text-text hover:bg-bg-alt"
              >
                Create account
              </Link>
            </div>
            <p className="text-[12px] text-text-muted">
              See the{' '}
              <Link
                href="/safety"
                className="text-accent hover:text-accent-hover"
              >
                safety policy
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export default async function PressureModelingTestBenchPage() {
  // Resolve admin context first so any error notice can offer the right
  // links to operators without leaking admin status to other viewers.
  const admin = await getAdminContext().catch(() => ({
    isAdmin: false,
    email: null,
    viaLocalDevFallback: false,
    reason: null as string | null,
  }));

  let ctx: Awaited<ReturnType<typeof getWorkspaceContext>>;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    const msg = describeError(e);
    if (msg === 'UNAUTHENTICATED') {
      return <UnauthenticatedNotice />;
    }
    return <SetupNotice message={msg} isAdmin={admin.isAdmin} />;
  }

  // Premium gating. Until the workspace has an active entitlement for
  // pressure_modeling, render only the paywall + safety copy. The DB
  // queries below are intentionally not executed in the locked state.
  let entitlement: Awaited<ReturnType<typeof getEntitlement>>;
  try {
    entitlement = await getEntitlement(
      ctx.workspaceId,
      FEATURE_KEYS.PRESSURE_MODELING,
    );
  } catch (e) {
    return (
      <SetupNotice message={describeError(e)} isAdmin={admin.isAdmin} />
    );
  }

  const bigcommerceConfigured = isBigCommerceConfigured();

  if (!entitlement.hasAccess) {
    return (
      <>
        <Topbar
          title="Pressure modeling test bench"
          actions={<Badge tone="accent">Premium</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
            data-testid="pressure-modeling-warning"
          >
            <strong className="font-semibold">
              Experimental validation workspace — not a pressure predictor, not
              load advice.
            </strong>{' '}
            Nothing on this page computes pressure, recommends a charge, or
            marks any load as safe or unsafe. A paid subscription unlocks
            additional review surfaces only — it does not turn LoadBench Pro
            into a load recommender. See the{' '}
            <Link href="/safety" className="text-accent hover:text-accent-hover">
              safety policy
            </Link>
            .
          </div>
          <PaywallNotice
            entitlement={entitlement}
            bigcommerceConfigured={bigcommerceConfigured}
            featureBullets={[
              'Pressure-modeling test bench: structured notes, model-version records, and load-readiness review surfaces.',
              'Validation-record bookkeeping that a future expert-reviewed internal-ballistics model would have to pass before it could ever be enabled.',
              'Expanded solver-input data capture surfaces for case capacity, bullet dimensions, powder metadata, barrel geometry, and chrono calibration.',
              'Pressure engine workspace at /pressure-engine: run-history dashboard with a reserved (disabled) internal chamber pressure model output panel.',
            ]}
          />
          <Card data-testid="pressure-modeling-locked-engine-link">
            <CardHeader
              title="Pressure engine workspace"
              description="The main premium pressure workspace lives at /pressure-engine. Pressure prediction remains disabled there regardless of entitlement."
            />
            <CardBody>
              <Link
                href="/pressure-engine"
                className="text-[13px] text-accent hover:text-accent-hover"
                data-testid="link-pressure-engine"
              >
                Open pressure engine →
              </Link>
            </CardBody>
          </Card>
          {admin.isAdmin && (
            <Card data-testid="pressure-modeling-admin-shortcut">
              <CardHeader
                title="Admin · Entitlements"
                description="Manually grant or revoke pressure_modeling access while BigCommerce checkout is not configured. Manual entitlement never enables pressure prediction or load advice."
              />
              <CardBody>
                <Link
                  href="/admin/entitlements"
                  className="text-[13px] text-accent hover:text-accent-hover"
                  data-testid="link-admin-entitlements"
                >
                  Manage entitlements →
                </Link>
              </CardBody>
            </Card>
          )}
        </div>
      </>
    );
  }

  const queries = await loadPressureModelingData(ctx.workspaceId).catch(
    (e: unknown) => ({ error: describeError(e) }) as const,
  );
  if ('error' in queries) {
    return <SetupNotice message={queries.error} isAdmin={admin.isAdmin} />;
  }
  const {
    loads,
    sources,
    modelVersions,
    validationRecords,
    solverInputCounts,
    recentSimulationRuns,
  } = queries;

  const checklist = solverReadinessChecklist();

  return (
    <>
      <Topbar
        title="Pressure modeling test bench"
        actions={<Badge tone="warning">Experimental</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
          data-testid="pressure-modeling-warning"
        >
          <strong className="font-semibold">
            Experimental validation workspace — not a pressure predictor, not
            load advice.
          </strong>{' '}
          Nothing on this page computes pressure, recommends a charge, or marks
          any load as safe or unsafe. Records here are structured notes the
          team uses to build the validation infrastructure a future
          internal-ballistics model would have to pass before it could ever be
          enabled. See the{' '}
          <Link href="/safety" className="text-accent hover:text-accent-hover">
            safety policy
          </Link>
          .
        </div>

        <Card data-testid="pressure-modeling-engine-link">
          <CardHeader
            title="Pressure engine workspace"
            description="The pressure engine at /pressure-engine is the main premium workspace: run-history dashboard, governance-status table, and a reserved (disabled) internal chamber pressure model output panel. Pressure prediction remains disabled regardless of entitlement."
            actions={
              <Link
                href="/pressure-engine"
                className="text-[12px] text-accent hover:text-accent-hover"
                data-testid="link-pressure-engine"
              >
                Open pressure engine →
              </Link>
            }
          />
        </Card>

        <Card>
          <CardHeader
            title="Simulation sandbox"
            description="Velocity-only comparison of reference / chrono observations against placeholder model versions. Review-state bookkeeping only. No pressure prediction, no load advice."
            actions={
              <Link
                href="/simulation-sandbox"
                className="text-[12px] text-accent hover:text-accent-hover"
                data-testid="link-simulation-sandbox"
              >
                Open sandbox →
              </Link>
            }
          />
          <CardBody>
            {recentSimulationRuns.length === 0 ? (
              <p
                className="text-[12px] text-text-muted"
                data-testid="pressure-modeling-simulation-empty"
              >
                No simulation runs yet. Reference data and chrono sessions
                recorded in this workspace can be compared against placeholder
                model versions in the sandbox.
              </p>
            ) : (
              <ul
                className="space-y-2"
                data-testid="pressure-modeling-recent-simulations"
              >
                {recentSimulationRuns.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between border-l-2 border-border pl-4 py-1 text-[12px]"
                  >
                    <span className="text-text">
                      {r.modelVersion.name}
                    </span>
                    <span className="text-text-muted">
                      {r.status} · Δ{' '}
                      {r.velocityDeltaFps != null
                        ? `${r.velocityDeltaFps >= 0 ? '+' : ''}${r.velocityDeltaFps.toFixed(1)} fps`
                        : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Solver readiness checklist"
            description="Project-level gates that must be passed before any pressure solver could be considered for enablement. Documentation, not a toggle."
          />
          <CardBody>
            <ul
              className="space-y-3"
              data-testid="solver-readiness-checklist"
            >
              {checklist.map((item) => (
                <li
                  key={item.key}
                  className="border-l-2 border-border pl-4 py-1"
                  data-testid={`solver-readiness-${item.key}`}
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
            title="Solver input record counts"
            description="Counts of workspace-scoped solver-input records. Counts only — no pressure math, no charge advice."
            actions={
              <Link
                href="/solver-inputs"
                className="text-[12px] text-accent hover:text-accent-hover"
              >
                Manage records →
              </Link>
            }
          />
          <CardBody>
            <ul
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              data-testid="solver-input-counts"
            >
              {[
                {
                  key: 'case-capacity',
                  label: 'Case capacity measurements',
                  count: solverInputCounts.caseCapacity,
                },
                {
                  key: 'bullet-dimensions',
                  label: 'Bullet dimension records',
                  count: solverInputCounts.bulletDimensions,
                },
                {
                  key: 'powder-metadata',
                  label: 'Powder metadata records',
                  count: solverInputCounts.powderMetadata,
                },
                {
                  key: 'barrel-geometry',
                  label: 'Barrel geometry records',
                  count: solverInputCounts.barrelGeometry,
                },
                {
                  key: 'chrono-calibration',
                  label: 'Chrono calibration records',
                  count: solverInputCounts.chronoCalibration,
                },
              ].map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between border-l-2 border-border pl-4 py-1"
                  data-testid={`solver-input-count-${item.key}`}
                >
                  <span className="text-[13px] text-text">{item.label}</span>
                  <Badge tone={item.count > 0 ? 'success' : 'neutral'}>
                    {item.count}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-text-faint">
              Counts here describe how much measurement / metadata coverage
              exists. They do not imply any load is ready, recommended, or
              safe.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Load input completeness"
            description="Pick a load to see which inputs a future model would need. This is a readiness checklist, not a pressure prediction."
          />
          <CardBody>
            {loads.length === 0 ? (
              <p
                className="text-[12px] text-text-muted"
                data-testid="pressure-modeling-loads-empty"
              >
                No loads in this workspace yet.{' '}
                <Link
                  href="/loads"
                  className="text-accent hover:text-accent-hover"
                >
                  Record a load
                </Link>{' '}
                first to assess input completeness.
              </p>
            ) : (
              <LoadReadinessSelector loads={loads} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Capture a validation dataset row"
            description="Record user-entered published or lab-measured reference data. These rows are inputs to a future calibration check — never outputs of one."
            actions={<Badge tone="warning">Acknowledgement required</Badge>}
          />
          <CardBody>
            <PressureValidationRecordForm
              loads={loads}
              sources={sources}
              modelVersions={modelVersions.map((m) => ({
                id: m.id,
                name: m.name,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Model version registry"
            description="A list of candidate model identities and their review status. Versions are documentation; this app does not execute any of them."
          />
          <CardBody>
            <div className="space-y-6">
              <PressureModelVersionForm />

              {modelVersions.length === 0 ? (
                <p
                  className="text-[12px] text-text-muted"
                  data-testid="pressure-model-versions-empty"
                >
                  No model versions recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table data-testid="pressure-model-versions-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Description</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelVersions.map((m) => (
                        <tr key={m.id}>
                          <td className="text-text">{m.name}</td>
                          <td>
                            <Badge tone={statusTone(m.status as StatusKey)}>
                              {STATUS_LABEL[m.status as StatusKey]}
                            </Badge>
                          </td>
                          <td className="text-text-muted">
                            {m.description ?? '—'}
                          </td>
                          <td className="text-text-faint">
                            {new Date(m.updatedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Test run log"
            description="Status of each validation dataset row. Computed pressure values are intentionally not displayed."
            actions={<Badge tone="neutral">Status only</Badge>}
          />
          <CardBody>
            {validationRecords.length === 0 ? (
              <p
                className="text-[12px] text-text-muted"
                data-testid="pressure-validation-empty"
              >
                No validation records yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table data-testid="pressure-validation-records-table">
                  <thead>
                    <tr>
                      <th>Reference label</th>
                      <th>Status</th>
                      <th>Load</th>
                      <th>Source</th>
                      <th>Model version</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="text-text">{r.referenceLabel}</td>
                        <td>
                          <Badge tone={statusTone(r.status as StatusKey)}>
                            {STATUS_LABEL[r.status as StatusKey]}
                          </Badge>
                        </td>
                        <td className="text-text-muted">
                          {r.load?.name ?? '—'}
                        </td>
                        <td className="text-text-muted">
                          {r.source?.title ?? '—'}
                        </td>
                        <td className="text-text-muted">
                          {r.modelVersion?.name ?? '—'}
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
              This log intentionally omits any computed pressure prediction.
              Statuses describe review state only — never safety.
            </p>
          </CardBody>
        </Card>

        {admin.isAdmin && (
          <Card data-testid="pressure-modeling-admin-shortcut">
            <CardHeader
              title="Admin · Entitlements"
              description="Manually grant or revoke pressure_modeling access. Manual entitlement never enables pressure prediction or load advice."
              actions={<Badge tone="accent">Operator</Badge>}
            />
            <CardBody>
              <Link
                href="/admin/entitlements"
                className="text-[13px] text-accent hover:text-accent-hover"
                data-testid="link-admin-entitlements"
              >
                Manage entitlements →
              </Link>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              This page is a structured note-taking surface for experimental
              pressure-modeling validation. It does not predict pressure,
              recommend charges, propose powder substitutions, or certify any
              load. Until expert validation, documented variance bounds, and
              corpus coverage are all in place, no solver will be enabled.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

async function loadPressureModelingData(workspaceId: string) {
  const [
    loads,
    sources,
    modelVersions,
    validationRecords,
    caseCapacityCount,
    bulletDimensionCount,
    powderMetadataCount,
    barrelGeometryCount,
    chronoCalibrationCount,
    recentSimulationRuns,
  ] = await Promise.all([
    prisma.load.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.source.findMany({
      where: { workspaceId },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    }),
    prisma.pressureModelVersion.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.pressureValidationRecord.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        load: { select: { id: true, name: true } },
        source: { select: { id: true, title: true } },
        modelVersion: { select: { id: true, name: true } },
      },
    }),
    prisma.caseCapacityMeasurement.count({ where: { workspaceId } }),
    prisma.bulletDimensionRecord.count({ where: { workspaceId } }),
    prisma.powderMetadataRecord.count({ where: { workspaceId } }),
    prisma.barrelGeometryRecord.count({ where: { workspaceId } }),
    prisma.chronoCalibrationRecord.count({ where: { workspaceId } }),
    prisma.simulationRun.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        modelVersion: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    loads,
    sources,
    modelVersions,
    validationRecords,
    solverInputCounts: {
      caseCapacity: caseCapacityCount,
      bulletDimensions: bulletDimensionCount,
      powderMetadata: powderMetadataCount,
      barrelGeometry: barrelGeometryCount,
      chronoCalibration: chronoCalibrationCount,
    },
    recentSimulationRuns,
  };
}
