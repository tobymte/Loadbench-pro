import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { FEATURE_KEYS, getEntitlement } from '@/lib/billing/entitlements';
import { isBigCommerceConfigured } from '@/lib/billing/bigcommerce';
import { PaywallNotice } from '@/components/billing/PaywallNotice';
import {
  PRESSURE_PREDICTION_DISABLED_REASON,
} from '@/lib/validation/pressureEngine';
import {
  PressureEngineRunBuilder,
  type BuilderLoad,
  type BuilderModelVersion,
  type BuilderRangeSession,
  type BuilderValidationRecord,
} from '@/components/forms/PressureEngineRunBuilder';

export const dynamic = 'force-dynamic';

// Pressure engine — Run Builder.
//
// SAFETY: Lets users with the pressure_modeling entitlement select existing
// workspace records (model version, load, range session, validation record)
// and record a non-operational engine run. This page intentionally renders
// no pressure prediction, no PSI, no charge advice, no safe/unsafe verdict.
// The submission funnels through the same /api/pressure-engine/runs route
// with all forbidden-key and acknowledgement guardrails enforced.

const BUILDER_BULLETS = [
  'Pick a candidate model version, load, range session, and reference validation record from this workspace.',
  'Build a read-only input snapshot preview and a data-readiness checklist before submission.',
  'On save, the run records data completeness, missing fields, velocity-only delta, source coverage, and guardrail status — no PSI, no charge advice, no verdict.',
];

function SetupNotice({ message }: { message: string }) {
  return (
    <>
      <Topbar
        title="Pressure engine · New run"
        actions={<Badge tone="warning">Setup required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
          data-testid="pressure-engine-new-setup-required"
        >
          <p>
            <strong className="font-semibold">
              Pressure engine workspace is not ready yet.
            </strong>{' '}
            The run builder could not be loaded.
          </p>
          <p className="text-[12px] text-text-muted">{message}</p>
          <p className="text-[12px] text-text-muted">
            Typical fixes: run{' '}
            <code className="text-accent">npx prisma migrate deploy</code> then{' '}
            <code className="text-accent">npx prisma generate</code>, and
            confirm <code className="text-accent">DATABASE_URL</code> is set.
            Pressure prediction stays disabled regardless of setup state.
          </p>
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

export default async function PressureEngineNewRunPage() {
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
          title="Pressure engine · New run"
          actions={<Badge tone="accent">Premium</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
            data-testid="pressure-engine-new-locked"
          >
            <strong className="font-semibold">
              Pressure prediction is disabled.
            </strong>{' '}
            The pressure engine run builder is a controlled validation
            workspace only. It produces no PSI estimate, no charge
            recommendation, and no safe/unsafe verdict — paid access enables
            the engine shell and a future, expert-validated model slot. See
            the{' '}
            <Link
              href="/safety"
              className="text-accent hover:text-accent-hover"
            >
              safety policy
            </Link>
            .
          </div>
          <PaywallNotice
            entitlement={entitlement}
            bigcommerceConfigured={bigcommerceConfigured}
            title="Premium: pressure engine run builder"
            description="Paid access unlocks the controlled validation workspace and a future model slot. It does not turn LoadBench Pro into a load recommender — no PSI, peak pressure, charge advice, or safe/unsafe verdict is ever produced."
            featureBullets={BUILDER_BULLETS}
          />
          <p className="text-[12px]">
            <Link
              href="/pressure-engine"
              className="text-accent hover:text-accent-hover"
            >
              Back to pressure engine
            </Link>
          </p>
        </div>
      </>
    );
  }

  const queries = await loadBuilderData(ctx.workspaceId).catch(
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
    solverInputCounts,
  } = queries;

  return (
    <>
      <Topbar
        title="Pressure engine · New run"
        actions={<Badge tone="warning">Non-operational</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
          data-testid="pressure-engine-new-warning"
        >
          <p>
            <strong className="font-semibold">
              Pressure prediction is disabled.
            </strong>{' '}
            Every run saved from this page records{' '}
            <code className="text-accent">
              pressurePredictionStatus: &quot;disabled&quot;
            </code>{' '}
            in the audit log. No PSI estimate, peak pressure, charge
            recommendation, max-charge advice, safe/unsafe verdict, or powder
            substitution is produced.
          </p>
          <p className="text-[12px] text-text-muted">
            Select existing workspace records below to build an input snapshot
            and record a validation-only run. Blank states link to the
            relevant data-entry pages.
          </p>
          <p className="text-[12px]">
            <Link
              href="/pressure-engine"
              className="text-accent hover:text-accent-hover"
            >
              ← Back to pressure engine
            </Link>
          </p>
        </div>

        <Card>
          <CardHeader
            title="Build a pressure engine run"
            description="Select existing records, review the input snapshot and data-readiness checklist, then save a non-operational engine run."
            actions={<Badge tone="warning">Acknowledgement required</Badge>}
          />
          <CardBody>
            <PressureEngineRunBuilder
              modelVersions={modelVersions}
              loads={loads}
              rangeSessions={rangeSessions}
              validationRecords={validationRecords}
              solverInputCounts={solverInputCounts}
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

async function loadBuilderData(workspaceId: string) {
  const [
    modelVersionsRaw,
    loadsRaw,
    rangeSessionsRaw,
    validationRecordsRaw,
    caseCapacityCount,
    bulletDimensionCount,
    powderMetadataCount,
    barrelGeometryCount,
    chronoCalibrationCount,
  ] = await Promise.all([
    prisma.pressureModelVersion.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        governanceStatus: true,
      },
    }),
    prisma.load.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        status: true,
        chargeGr: true,
        safetyAcknowledged: true,
        cartridge: { select: { name: true } },
        bullet: {
          select: {
            manufacturer: true,
            model: true,
            bulletWeightGr: true,
          },
        },
        powder: { select: { manufacturer: true, model: true } },
        rifle: { select: { name: true } },
        source: { select: { title: true } },
        publishedDataRow: {
          select: {
            bulletName: true,
            powderName: true,
            chargeGr: true,
            pageLabel: true,
          },
        },
      },
    }),
    prisma.rangeSession.findMany({
      where: { workspaceId },
      orderBy: { date: 'desc' },
      take: 100,
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
    prisma.pressureValidationRecord.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        referenceLabel: true,
        referenceVelocityFps: true,
        measuredVelocityFps: true,
        referencePressurePsi: true,
        source: { select: { title: true } },
      },
    }),
    prisma.caseCapacityMeasurement.count({ where: { workspaceId } }),
    prisma.bulletDimensionRecord.count({ where: { workspaceId } }),
    prisma.powderMetadataRecord.count({ where: { workspaceId } }),
    prisma.barrelGeometryRecord.count({ where: { workspaceId } }),
    prisma.chronoCalibrationRecord.count({ where: { workspaceId } }),
  ]);

  const modelVersions: BuilderModelVersion[] = modelVersionsRaw.map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    governanceStatus: m.governanceStatus,
  }));

  const loads: BuilderLoad[] = loadsRaw.map((l) => {
    const bulletParts: string[] = [];
    if (l.bullet?.manufacturer) bulletParts.push(l.bullet.manufacturer);
    if (l.bullet?.model) bulletParts.push(l.bullet.model);
    if (l.bullet?.bulletWeightGr != null)
      bulletParts.push(`${l.bullet.bulletWeightGr}gr`);
    const bulletLabel = bulletParts.length === 0 ? null : bulletParts.join(' ');

    const powderParts: string[] = [];
    if (l.powder?.manufacturer) powderParts.push(l.powder.manufacturer);
    if (l.powder?.model) powderParts.push(l.powder.model);
    const powderLabel = powderParts.length === 0 ? null : powderParts.join(' ');

    let publishedRowLabel: string | null = null;
    if (l.publishedDataRow) {
      const parts: string[] = [];
      if (l.publishedDataRow.bulletName)
        parts.push(l.publishedDataRow.bulletName);
      if (l.publishedDataRow.powderName)
        parts.push(l.publishedDataRow.powderName);
      if (l.publishedDataRow.chargeGr != null)
        parts.push(`${l.publishedDataRow.chargeGr}gr`);
      if (l.publishedDataRow.pageLabel)
        parts.push(`p. ${l.publishedDataRow.pageLabel}`);
      publishedRowLabel = parts.length === 0 ? null : parts.join(' · ');
    }

    return {
      id: l.id,
      name: l.name,
      status: l.status,
      chargeGr: l.chargeGr,
      cartridgeName: l.cartridge?.name ?? null,
      bulletLabel,
      powderLabel,
      rifleName: l.rifle?.name ?? null,
      sourceTitle: l.source?.title ?? null,
      publishedRowLabel,
      safetyAcknowledged: l.safetyAcknowledged,
    };
  });

  const rangeSessions: BuilderRangeSession[] = rangeSessionsRaw.map((s) => ({
    id: s.id,
    dateIso: s.date.toISOString(),
    avgVelocityFps: s.avgVelocityFps,
    esFps: s.esFps,
    sdFps: s.sdFps,
    shotsFired: s.shotsFired,
    loadName: s.load?.name ?? null,
  }));

  const validationRecords: BuilderValidationRecord[] =
    validationRecordsRaw.map((v) => ({
      id: v.id,
      referenceLabel: v.referenceLabel,
      referenceVelocityFps: v.referenceVelocityFps,
      measuredVelocityFps: v.measuredVelocityFps,
      referencePressurePsi: v.referencePressurePsi,
      sourceTitle: v.source?.title ?? null,
    }));

  return {
    modelVersions,
    loads,
    rangeSessions,
    validationRecords,
    solverInputCounts: {
      caseCapacity: caseCapacityCount,
      bulletDimensions: bulletDimensionCount,
      powderMetadata: powderMetadataCount,
      barrelGeometry: barrelGeometryCount,
      chronoCalibration: chronoCalibrationCount,
    },
  };
}
