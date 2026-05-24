import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { PaywallNotice } from '@/components/billing/PaywallNotice';
import { FEATURE_KEYS, getEntitlement } from '@/lib/billing/entitlements';
import { isBigCommerceConfigured } from '@/lib/billing/bigcommerce';
import { PressureEngineRunForm } from '@/components/forms/PressureEngineRunForm';
import {
  PRESSURE_PREDICTION_DISABLED_REASON,
  type PressureEngineRunStatus,
} from '@/lib/validation/pressureEngine';
import {
  PressureEngineDashboard,
  type DashboardEngineRunRow,
} from '@/components/pressure/PressureEngineDashboard';
import { PressureEngineSteps } from '@/components/pressure/PressureEngineSteps';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export const dynamic = 'force-dynamic';

// Pressure engine workspace.
//
// SAFETY: this page intentionally renders ONLY non-prescriptive data:
//   * data completeness score and missing-field bookkeeping
//   * velocity-only delta (fps + %) where both reference and observed values
//     have been supplied
//   * input-consistency warnings (descriptive, never a safety verdict)
//   * the literal `pressurePredictionStatus: 'disabled'` for every run
//
// There is no PSI value, no charge recommendation, no safe/unsafe verdict,
// and no powder-substitution suggestion anywhere on this page or in the
// route handlers it calls. A reserved "Internal chamber pressure model
// output" panel is rendered explicitly disabled with the gating policy.

const PREMIUM_DISPLAY_BULLETS = [
  'Workspace overview: engine runs, model versions, validation records, range sessions.',
  'Solver-input data-readiness checklist (cartridges, case capacity, bullet dimensions, powder metadata, barrel geometry, chrono calibration, published source coverage, validation records).',
  'Model version / governance status table with blocked-outputs policy and validation notes.',
  'Engine run history with per-run drill-down: input completeness, missing fields, velocity-only delta, source coverage, warnings, and the disabled prediction status.',
  'Reserved "Internal chamber pressure model output" panel — intentionally disabled until validated lab model, SAAMI/CIP/manufacturer review, legal/safety review, and instrumented test validation are complete.',
  'Hard server-side guardrails: forbidden-key rejection on inbound bodies, outbound stripping, and audit-stored `pressurePredictionStatus = "disabled"` on every run.',
];

function SetupNotice({ message }: { message: string }) {
  return (
    <>
      <Topbar
        title="Pressure engine"
        actions={<Badge tone="warning">Setup required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
          data-testid="pressure-engine-setup-required"
        >
          <p>
            <strong className="font-semibold">
              Pressure engine workspace is not ready yet.
            </strong>{' '}
            The non-operational engine shell could not be loaded.
          </p>
          <p className="text-[12px] text-text-muted">{message}</p>
          <p className="text-[12px] text-text-muted">
            Typical fixes: run{' '}
            <code className="text-accent">npx prisma migrate deploy</code> then{' '}
            <code className="text-accent">npx prisma generate</code>, and
            confirm <code className="text-accent">DATABASE_URL</code> is set.
            Pressure prediction remains disabled regardless of setup state.
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

export default async function PressureEnginePage() {
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

  const bigcommerceConfigured = isBigCommerceConfigured();

  if (!entitlement.hasAccess) {
    return (
      <>
        <Topbar
          title="Pressure engine"
          actions={<Badge tone="accent">Premium</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
            data-testid="pressure-engine-locked-warning"
          >
            <strong className="font-semibold">
              Pressure prediction is disabled.
            </strong>{' '}
            The pressure engine is a controlled validation workspace only. It
            produces no PSI estimate, no charge recommendation, and no
            safe/unsafe verdict — paid access enables the engine shell and a
            future, expert-validated model slot. See the{' '}
            <Link
              href="/safety"
              className="text-accent hover:text-accent-hover"
            >
              safety policy
            </Link>
            .
          </div>

          <Card data-testid="pressure-engine-locked-displays">
            <CardHeader
              title="What premium unlocks"
              description="Display surfaces. Paid access never enables pressure predictions, charge advice, or safe/unsafe verdicts — those are governed by a separate validation pipeline that has not been completed."
            />
            <CardBody>
              <ul className="list-disc pl-5 text-[13px] text-text space-y-1">
                {PREMIUM_DISPLAY_BULLETS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card
            className="border-danger/40"
            data-testid="pressure-engine-locked-reserved-output"
          >
            <CardHeader
              title="Internal chamber pressure model output"
              description="Reserved display slot. Even with premium access, this panel remains disabled until validated lab model, SAAMI / CIP / manufacturer review, legal / safety review, and instrumented test validation are all complete."
              actions={<Badge tone="danger">Disabled</Badge>}
            />
            <CardBody>
              <p className="text-[12px] text-text-muted leading-relaxed">
                {PRESSURE_PREDICTION_DISABLED_REASON}
              </p>
            </CardBody>
          </Card>

          <PaywallNotice
            entitlement={entitlement}
            bigcommerceConfigured={bigcommerceConfigured}
            title="Premium: pressure engine workspace"
            description="Paid access unlocks the controlled validation workspace and a future model slot. It does not turn LoadBench Pro into a load recommender — no PSI, peak pressure, charge advice, or safe/unsafe verdict is ever produced."
            featureBullets={PREMIUM_DISPLAY_BULLETS}
          />
        </div>
      </>
    );
  }

  const queries = await loadPressureEngineData(ctx.workspaceId).catch(
    (e: unknown) => ({ error: describeError(e) }) as const,
  );
  if ('error' in queries) {
    return <SetupNotice message={queries.error} />;
  }
  const {
    modelVersions,
    loads,
    rangeSessions,
    validationRecords,
    engineRuns,
    counts,
  } = queries;

  const dashboardRuns: DashboardEngineRunRow[] = engineRuns.map((r) => {
    const outputs = parseOutputs(r.outputsJson);
    return {
      id: r.id,
      createdAt: r.createdAt,
      status: r.status as PressureEngineRunStatus,
      pressurePredictionStatus: r.pressurePredictionStatus,
      velocityDeltaFps: r.velocityDeltaFps,
      velocityDeltaPct: r.velocityDeltaPct,
      modelName: r.modelVersion?.name ?? null,
      loadName: r.load?.name ?? null,
      rangeSessionDate: r.rangeSession?.date ?? null,
      validationLabel: r.validationRecord?.referenceLabel ?? null,
      dataCompleteness: outputs?.dataCompleteness ?? null,
      missingFields: outputs?.missingFields ?? [],
      inputConsistencyWarnings: outputs?.inputConsistencyWarnings ?? [],
      sourceCoverage: outputs?.sourceCoverage ?? null,
    };
  });

  return (
    <>
      <Topbar
        title="Pressure engine"
        actions={
          <>
            <Link href="/pressure-engine/setup">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="pressure-engine-setup-wizard-button"
              >
                Setup wizard
              </Button>
            </Link>
            <Link href="/pressure-engine/new">
              <Button
                type="button"
                size="sm"
                data-testid="pressure-engine-new-run-button"
              >
                + New run
              </Button>
            </Link>
            <Badge tone="warning">Non-operational</Badge>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            { label: 'Pressure engine' },
          ]}
        />
        <PressureEngineSteps active="overview" />
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
          data-testid="pressure-engine-warning"
        >
          <p>
            <strong className="font-semibold">
              Pressure prediction is disabled.
            </strong>{' '}
            Every run on this page records{' '}
            <code className="text-accent">
              pressurePredictionStatus: &quot;disabled&quot;
            </code>{' '}
            in the audit log. No PSI estimate, peak pressure, charge
            recommendation, max-charge advice, safe/unsafe verdict, or powder
            substitution is produced.
          </p>
          <p className="text-[12px] text-text-muted">
            Premium access enables this controlled validation workspace and a
            future model slot. Enabling a pressure model is gated on a
            validated lab model, SAAMI/CIP/manufacturer data review,
            legal/safety review, and instrumented test validation — none of
            which are currently complete.
          </p>
          <p className="text-[12px] text-text-muted">
            See the{' '}
            <Link
              href="/safety"
              className="text-accent hover:text-accent-hover"
            >
              safety policy
            </Link>{' '}
            and the{' '}
            <Link
              href="/pressure-modeling"
              className="text-accent hover:text-accent-hover"
            >
              pressure modeling test bench
            </Link>{' '}
            for validation infrastructure. New to the workspace? Start with
            the{' '}
            <Link
              href="/pressure-engine/setup"
              className="text-accent hover:text-accent-hover"
              data-testid="pressure-engine-setup-wizard-link"
            >
              setup wizard
            </Link>
            .
          </p>
        </div>

        <PressureEngineDashboard
          summary={counts}
          runs={dashboardRuns}
          modelVersions={modelVersions.map((m) => ({
            id: m.id,
            name: m.name,
            status: m.status,
            governanceStatus: m.governanceStatus,
            blockedOutputsPolicy: m.blockedOutputsPolicy,
            validationNotes: m.validationNotes,
          }))}
        />

        <Card>
          <CardHeader
            title="Run the engine (non-operational)"
            description="Select a candidate model version, a load, and any chrono / reference observations. The engine records data completeness, missing fields, source coverage, input-consistency warnings, and a velocity-only delta. It does not produce a pressure estimate or charge advice."
            actions={
              <>
                <Link href="/pressure-engine/new">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    data-testid="pressure-engine-open-builder"
                  >
                    Open run builder →
                  </Button>
                </Link>
                <Badge tone="warning">Acknowledgement required</Badge>
              </>
            }
          />
          <CardBody>
            <PressureEngineRunForm
              modelVersions={modelVersions.map((m) => ({
                id: m.id,
                label: `${m.name} · ${m.status}${m.governanceStatus ? ` · ${m.governanceStatus}` : ''}`,
              }))}
              loads={loads.map((l) => ({ id: l.id, label: l.name }))}
              rangeSessions={rangeSessions.map((s) => ({
                id: s.id,
                label: `${new Date(s.date).toLocaleDateString()} · ${s.load?.name ?? 'no load'} · ${
                  s.avgVelocityFps != null
                    ? `${s.avgVelocityFps.toFixed(0)} fps avg`
                    : 'no avg'
                }`,
              }))}
              validationRecords={validationRecords.map((v) => ({
                id: v.id,
                label: `${v.referenceLabel}${v.referenceVelocityFps != null ? ` · ref ${v.referenceVelocityFps.toFixed(0)} fps` : ''}`,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              {PRESSURE_PREDICTION_DISABLED_REASON}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

type ParsedOutputs = {
  dataCompleteness?: number;
  missingFields?: string[];
  inputConsistencyWarnings?: string[];
  sourceCoverage?: {
    hasLinkedLoad: boolean;
    hasModelVersion: boolean;
    hasReferenceVelocity: boolean;
    hasObservedVelocity: boolean;
    hasReferencePressure: boolean;
    hasRangeSession: boolean;
  };
};

function parseOutputs(raw: string | null): ParsedOutputs | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedOutputs;
  } catch {
    return null;
  }
}

async function loadPressureEngineData(workspaceId: string) {
  const [
    modelVersions,
    loads,
    rangeSessions,
    validationRecords,
    engineRuns,
    cartridgeCount,
    componentCount,
    rifleCount,
    sourceCount,
    rangeSessionCount,
    validationRecordCount,
    modelVersionCount,
    loadCount,
    caseCapacityCount,
    bulletDimensionCount,
    powderMetadataCount,
    barrelGeometryCount,
    chronoCalibrationCount,
    publishedRowsVerifiedCount,
    publishedRowsTotalCount,
    engineRunsCount,
  ] = await Promise.all([
    prisma.pressureModelVersion.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        governanceStatus: true,
        blockedOutputsPolicy: true,
        validationNotes: true,
        updatedAt: true,
      },
    }),
    prisma.load.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.rangeSession.findMany({
      where: { workspaceId },
      orderBy: { date: 'desc' },
      take: 50,
      select: {
        id: true,
        date: true,
        avgVelocityFps: true,
        load: { select: { name: true } },
      },
    }),
    prisma.pressureValidationRecord.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        referenceLabel: true,
        referenceVelocityFps: true,
      },
    }),
    prisma.pressureEngineRun.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        modelVersion: { select: { id: true, name: true } },
        load: { select: { id: true, name: true } },
        rangeSession: { select: { id: true, date: true } },
        validationRecord: { select: { id: true, referenceLabel: true } },
      },
    }),
    prisma.cartridge.count({ where: { workspaceId } }),
    prisma.component.count({ where: { workspaceId } }),
    prisma.rifle.count({ where: { workspaceId } }),
    prisma.source.count({ where: { workspaceId } }),
    prisma.rangeSession.count({ where: { workspaceId } }),
    prisma.pressureValidationRecord.count({ where: { workspaceId } }),
    prisma.pressureModelVersion.count({ where: { workspaceId } }),
    prisma.load.count({ where: { workspaceId } }),
    prisma.caseCapacityMeasurement.count({ where: { workspaceId } }),
    prisma.bulletDimensionRecord.count({ where: { workspaceId } }),
    prisma.powderMetadataRecord.count({ where: { workspaceId } }),
    prisma.barrelGeometryRecord.count({ where: { workspaceId } }),
    prisma.chronoCalibrationRecord.count({ where: { workspaceId } }),
    prisma.publishedLoadRowDraft.count({
      where: { workspaceId, status: 'VERIFIED' },
    }),
    prisma.publishedLoadRowDraft.count({ where: { workspaceId } }),
    prisma.pressureEngineRun.count({ where: { workspaceId } }),
  ]);

  const counts = {
    loads: loadCount,
    cartridges: cartridgeCount,
    components: componentCount,
    rifles: rifleCount,
    sources: sourceCount,
    rangeSessions: rangeSessionCount,
    validationRecords: validationRecordCount,
    modelVersions: modelVersionCount,
    caseCapacityMeasurements: caseCapacityCount,
    bulletDimensionRecords: bulletDimensionCount,
    powderMetadataRecords: powderMetadataCount,
    barrelGeometryRecords: barrelGeometryCount,
    chronoCalibrationRecords: chronoCalibrationCount,
    publishedRowsVerified: publishedRowsVerifiedCount,
    publishedRowsTotal: publishedRowsTotalCount,
    engineRuns: engineRunsCount,
  };

  return {
    modelVersions,
    loads,
    rangeSessions,
    validationRecords,
    engineRuns,
    counts,
  };
}
