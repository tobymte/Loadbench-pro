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
import { PRESSURE_PREDICTION_DISABLED_REASON } from '@/lib/validation/pressureEngine';

export const dynamic = 'force-dynamic';

// Pressure engine — Setup Wizard.
//
// SAFETY: This page is a *readiness checklist only*. It inspects existing
// workspace records and reports which inputs are present or missing for the
// pressure-engine validation workflow. It never produces a pressure estimate,
// PSI, charge recommendation, safe/unsafe verdict, powder substitution, or
// any load advice. The "Start validation run" CTA links to the run builder
// at /pressure-engine/new — which itself produces only non-operational,
// disabled-prediction runs.

const WIZARD_BULLETS = [
  'Inspect every required and important input for a pressure-engine validation run.',
  'See what is present, what is missing, and why each input matters.',
  'Jump straight to the existing entry page that captures each input.',
  'Track a readiness score and only start a validation run once enough data exists.',
];

type StepStatus = 'ready' | 'missing' | 'partial';

type WizardStep = {
  id: string;
  title: string;
  required: boolean;
  status: StepStatus;
  count: number;
  why: string;
  detail: string;
  href: string;
  ctaLabel: string;
  hint?: string;
};

function SetupNotice({ message }: { message: string }) {
  return (
    <>
      <Topbar
        title="Pressure engine · Setup wizard"
        actions={<Badge tone="warning">Setup required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
          data-testid="pressure-engine-wizard-setup-required"
        >
          <p>
            <strong className="font-semibold">
              Pressure engine setup wizard is not ready yet.
            </strong>{' '}
            The wizard could not be loaded.
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
              ← Back to pressure engine
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

function statusBadge(status: StepStatus) {
  if (status === 'ready') return <Badge tone="success">Ready</Badge>;
  if (status === 'partial') return <Badge tone="warning">Partial</Badge>;
  return <Badge tone="danger">Missing</Badge>;
}

export default async function PressureEngineSetupWizardPage() {
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
          title="Pressure engine · Setup wizard"
          actions={<Badge tone="accent">Premium</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
            data-testid="pressure-engine-wizard-locked"
          >
            <strong className="font-semibold">
              Pressure prediction is disabled.
            </strong>{' '}
            The setup wizard is part of a controlled validation workspace. It
            never produces a PSI estimate, charge recommendation, or
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
          <PaywallNotice
            entitlement={entitlement}
            bigcommerceConfigured={bigcommerceConfigured}
            title="Premium: pressure engine setup wizard"
            description="Paid access unlocks the controlled validation workspace including this readiness wizard. It does not turn LoadBench Pro into a load recommender — no PSI, peak pressure, charge advice, or safe/unsafe verdict is ever produced."
            featureBullets={WIZARD_BULLETS}
          />
          <p className="text-[12px]">
            <Link
              href="/pressure-engine"
              className="text-accent hover:text-accent-hover"
            >
              ← Back to pressure engine
            </Link>
          </p>
        </div>
      </>
    );
  }

  const queries = await loadReadinessData(ctx.workspaceId).catch(
    (e: unknown) => ({ error: describeError(e) }) as const,
  );
  if ('error' in queries) {
    return <SetupNotice message={queries.error} />;
  }

  const steps = buildSteps(queries);
  const requiredSteps = steps.filter((s) => s.required);
  const requiredReady = requiredSteps.filter((s) => s.status === 'ready').length;
  const totalReady = steps.filter((s) => s.status === 'ready').length;
  const score = Math.round((totalReady / steps.length) * 100);
  const requiredScore = Math.round(
    (requiredReady / requiredSteps.length) * 100,
  );
  const canStartRun = requiredReady === requiredSteps.length;
  const missingRequired = requiredSteps.filter((s) => s.status !== 'ready');

  return (
    <>
      <Topbar
        title="Pressure engine · Setup wizard"
        actions={
          <>
            <Link href="/pressure-engine">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="pressure-engine-wizard-back"
              >
                ← Back to pressure engine
              </Button>
            </Link>
            <Badge tone="warning">Non-operational</Badge>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
          data-testid="pressure-engine-wizard-warning"
        >
          <p>
            <strong className="font-semibold">
              This wizard is a readiness checklist only.
            </strong>{' '}
            It inspects existing workspace data and tells you what is present
            or missing for a pressure-engine validation run. It does not
            calculate any PSI, charge weight, or safe/unsafe verdict, and
            never will.
          </p>
          <p className="text-[12px] text-text-muted">
            Pressure prediction remains{' '}
            <code className="text-accent">disabled</code>. Even when every
            input is captured, the run builder only records data completeness,
            missing-field bookkeeping, source coverage, and a velocity-only
            delta.
          </p>
        </div>

        <Card data-testid="pressure-engine-wizard-summary">
          <CardHeader
            title="Readiness summary"
            description="An overview of how prepared this workspace is to start a pressure-engine validation run."
            actions={
              canStartRun ? (
                <Badge tone="success">Ready to validate</Badge>
              ) : (
                <Badge tone="warning">More data needed</Badge>
              )
            }
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md border border-border bg-bg-alt px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">
                  Overall readiness
                </div>
                <div className="text-2xl font-semibold text-text">
                  {score}%
                </div>
                <div className="text-[11px] text-text-muted">
                  {totalReady} of {steps.length} steps ready
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-alt px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">
                  Required inputs
                </div>
                <div className="text-2xl font-semibold text-text">
                  {requiredScore}%
                </div>
                <div className="text-[11px] text-text-muted">
                  {requiredReady} of {requiredSteps.length} required ready
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-alt px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">
                  Start validation run
                </div>
                <div className="mt-1">
                  {canStartRun ? (
                    <Link href="/pressure-engine/new">
                      <Button
                        type="button"
                        size="sm"
                        data-testid="pressure-engine-wizard-start-run"
                      >
                        Start validation run →
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled
                      data-testid="pressure-engine-wizard-start-run-disabled"
                    >
                      Start validation run
                    </Button>
                  )}
                </div>
                <div className="text-[11px] text-text-muted mt-1">
                  {canStartRun
                    ? 'All required inputs are present.'
                    : `Resolve ${missingRequired.length} required step${missingRequired.length === 1 ? '' : 's'} first.`}
                </div>
              </div>
            </div>

            <div className="h-2 w-full rounded bg-bg-alt overflow-hidden border border-border">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${score}%` }}
                aria-label={`Readiness ${score}%`}
                data-testid="pressure-engine-wizard-progress"
              />
            </div>

            {!canStartRun && (
              <div
                className="rounded-md border border-border bg-bg-alt px-3 py-2 text-[12px] text-text"
                data-testid="pressure-engine-wizard-missing-required"
              >
                <div className="font-semibold mb-1">
                  Missing required inputs
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-text-muted">
                  {missingRequired.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={s.href}
                        className="text-accent hover:text-accent-hover"
                      >
                        {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Readiness steps"
            description="Each step inspects your workspace for a specific input. Click through to the existing entry page to add or edit data."
          />
          <CardBody>
            <ul
              className="divide-y divide-border"
              data-testid="pressure-engine-wizard-steps"
            >
              {steps.map((step, idx) => (
                <li
                  key={step.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-start gap-3"
                  data-testid={`pressure-engine-wizard-step-${step.id}`}
                  data-status={step.status}
                >
                  <div className="shrink-0 w-7 h-7 rounded-full border border-border bg-bg-alt flex items-center justify-center text-[12px] font-semibold text-text-muted">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-text">
                        {step.title}
                      </span>
                      {statusBadge(step.status)}
                      {step.required ? (
                        <Badge tone="accent">Required</Badge>
                      ) : (
                        <Badge tone="neutral">Important</Badge>
                      )}
                      <span className="text-[11px] text-text-faint">
                        {step.count.toLocaleString()} record
                        {step.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
                      <span className="font-medium text-text">Why: </span>
                      {step.why}
                    </p>
                    <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
                      {step.detail}
                    </p>
                    {step.hint && (
                      <p className="text-[11px] text-text-faint mt-1 italic">
                        {step.hint}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <Link href={step.href}>
                      <Button
                        type="button"
                        size="sm"
                        variant={step.status === 'ready' ? 'secondary' : 'primary'}
                      >
                        {step.ctaLabel}
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
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

type ReadinessData = {
  cartridgeCount: number;
  componentCount: number;
  rifleCount: number;
  loadCount: number;
  loadsLinkedToVerifiedPublishedCount: number;
  publishedVerifiedCount: number;
  publishedTotalCount: number;
  caseCapacityCount: number;
  bulletDimensionCount: number;
  powderMetadataCount: number;
  barrelGeometryCount: number;
  chronoCalibrationCount: number;
  rangeSessionCount: number;
  rangeSessionWithVelocityCount: number;
  validationRecordCount: number;
};

async function loadReadinessData(workspaceId: string): Promise<ReadinessData> {
  const [
    cartridgeCount,
    componentCount,
    rifleCount,
    loadCount,
    loadsLinkedToVerifiedPublishedCount,
    publishedVerifiedCount,
    publishedTotalCount,
    caseCapacityCount,
    bulletDimensionCount,
    powderMetadataCount,
    barrelGeometryCount,
    chronoCalibrationCount,
    rangeSessionCount,
    rangeSessionWithVelocityCount,
    validationRecordCount,
  ] = await Promise.all([
    prisma.cartridge.count({ where: { workspaceId } }),
    prisma.component.count({ where: { workspaceId } }),
    prisma.rifle.count({ where: { workspaceId } }),
    prisma.load.count({ where: { workspaceId } }),
    prisma.load.count({
      where: {
        workspaceId,
        publishedDataRow: { status: 'VERIFIED' },
      },
    }),
    prisma.publishedLoadRowDraft.count({
      where: { workspaceId, status: 'VERIFIED' },
    }),
    prisma.publishedLoadRowDraft.count({ where: { workspaceId } }),
    prisma.caseCapacityMeasurement.count({ where: { workspaceId } }),
    prisma.bulletDimensionRecord.count({ where: { workspaceId } }),
    prisma.powderMetadataRecord.count({ where: { workspaceId } }),
    prisma.barrelGeometryRecord.count({ where: { workspaceId } }),
    prisma.chronoCalibrationRecord.count({ where: { workspaceId } }),
    prisma.rangeSession.count({ where: { workspaceId } }),
    prisma.rangeSession.count({
      where: { workspaceId, avgVelocityFps: { not: null } },
    }),
    prisma.pressureValidationRecord.count({ where: { workspaceId } }),
  ]);

  return {
    cartridgeCount,
    componentCount,
    rifleCount,
    loadCount,
    loadsLinkedToVerifiedPublishedCount,
    publishedVerifiedCount,
    publishedTotalCount,
    caseCapacityCount,
    bulletDimensionCount,
    powderMetadataCount,
    barrelGeometryCount,
    chronoCalibrationCount,
    rangeSessionCount,
    rangeSessionWithVelocityCount,
    validationRecordCount,
  };
}

function buildSteps(d: ReadinessData): WizardStep[] {
  const steps: WizardStep[] = [];

  steps.push({
    id: 'cartridge',
    title: 'Cartridge defined',
    required: true,
    count: d.cartridgeCount,
    status: d.cartridgeCount > 0 ? 'ready' : 'missing',
    why: 'Every validation run is scoped to a cartridge; without one, no load or published row can be referenced.',
    detail:
      'Add at least one cartridge (e.g. 6mm ARC, 6.5 Creedmoor) so loads, components, and published rows can be linked to it.',
    href: '/cartridges',
    ctaLabel: d.cartridgeCount > 0 ? 'Manage cartridges' : 'Add cartridge',
  });

  steps.push({
    id: 'published-verified',
    title: 'Verified published reference row',
    required: true,
    count: d.publishedVerifiedCount,
    status:
      d.publishedVerifiedCount > 0
        ? 'ready'
        : d.publishedTotalCount > 0
          ? 'partial'
          : 'missing',
    why: 'Validation compares observations against an independently published manufacturer reference. A row must be marked VERIFIED before it can anchor a run.',
    detail:
      'Capture and verify at least one published manufacturer / loading-manual row in Published-data review. Drafts that have not been verified do not count for validation.',
    href: '/published-data-review',
    ctaLabel:
      d.publishedVerifiedCount > 0
        ? 'Review published rows'
        : d.publishedTotalCount > 0
          ? 'Verify existing draft'
          : 'Capture published row',
    hint:
      d.publishedTotalCount > 0 && d.publishedVerifiedCount === 0
        ? `${d.publishedTotalCount} draft row${d.publishedTotalCount === 1 ? '' : 's'} waiting for verification.`
        : undefined,
  });

  steps.push({
    id: 'load',
    title: 'Load created',
    required: true,
    count: d.loadCount,
    status:
      d.loadCount > 0
        ? d.loadsLinkedToVerifiedPublishedCount > 0
          ? 'ready'
          : 'partial'
        : 'missing',
    why: 'A load row ties together cartridge, bullet, powder, primer, charge, and a verified published source. The engine cannot record an input snapshot without one.',
    detail:
      'Create at least one load and link it to a verified published row so the validation run has a complete, attributable input snapshot.',
    href: d.loadCount > 0 ? '/loads' : '/loads/new',
    ctaLabel: d.loadCount > 0 ? 'Manage loads' : 'Create load',
    hint:
      d.loadCount > 0 && d.loadsLinkedToVerifiedPublishedCount === 0
        ? 'No load is linked to a verified published row yet — edit a load to attach one.'
        : undefined,
  });

  steps.push({
    id: 'rifle-barrel',
    title: 'Rifle and barrel geometry',
    required: true,
    count: d.rifleCount + d.barrelGeometryCount,
    status:
      d.rifleCount > 0 && d.barrelGeometryCount > 0
        ? 'ready'
        : d.rifleCount > 0 || d.barrelGeometryCount > 0
          ? 'partial'
          : 'missing',
    why: 'Barrel length, twist, and geometry feed every internal-ballistics consistency check; without them the engine cannot reason about observed-vs-reference velocity.',
    detail: `Add at least one rifle (${d.rifleCount} present) and one barrel-geometry record (${d.barrelGeometryCount} present). Rifle metadata lives under Rifles; geometry is captured under Solver inputs.`,
    href: d.rifleCount === 0 ? '/rifles' : '/solver-inputs',
    ctaLabel:
      d.rifleCount === 0
        ? 'Add rifle'
        : d.barrelGeometryCount === 0
          ? 'Add barrel geometry'
          : 'Review geometry',
  });

  steps.push({
    id: 'case-capacity',
    title: 'Case capacity measurement',
    required: true,
    count: d.caseCapacityCount,
    status: d.caseCapacityCount > 0 ? 'ready' : 'missing',
    why: 'Measured H₂O case capacity drives every internal-ballistics consistency cross-check between published charge weights and observed velocity.',
    detail:
      'Weigh at least one fired-and-sized case filled with water (grains H₂O) and record it under Solver inputs.',
    href: '/solver-inputs',
    ctaLabel:
      d.caseCapacityCount > 0 ? 'Manage capacity' : 'Record measurement',
  });

  steps.push({
    id: 'bullet-dimensions',
    title: 'Bullet dimensions',
    required: true,
    count: d.bulletDimensionCount,
    status: d.bulletDimensionCount > 0 ? 'ready' : 'missing',
    why: 'Bearing-surface length, ogive profile, and base-to-ogive influence seating depth and barrel-time consistency checks.',
    detail:
      'Capture at least one bullet-dimension record for the projectile you plan to validate.',
    href: '/solver-inputs',
    ctaLabel:
      d.bulletDimensionCount > 0
        ? 'Manage dimensions'
        : 'Record bullet dimensions',
  });

  steps.push({
    id: 'powder-metadata',
    title: 'Powder metadata',
    required: true,
    count: d.powderMetadataCount,
    status: d.powderMetadataCount > 0 ? 'ready' : 'missing',
    why: 'Lot-level metadata (manufacturer code, lot number, bulk density) supports consistency checks against the published source; the engine never substitutes one powder for another.',
    detail:
      'Record at least one powder-metadata entry under Solver inputs.',
    href: '/solver-inputs',
    ctaLabel:
      d.powderMetadataCount > 0 ? 'Manage metadata' : 'Record powder metadata',
  });

  steps.push({
    id: 'chrono-calibration',
    title: 'Chrono calibration',
    required: false,
    count: d.chronoCalibrationCount,
    status: d.chronoCalibrationCount > 0 ? 'ready' : 'missing',
    why: 'A documented calibration (device, sample-to-muzzle distance, ambient conditions) qualifies observed velocity numbers; without it, observations are treated with reduced trust.',
    detail:
      'Add a chrono-calibration record under Solver inputs for the chronograph you used.',
    href: '/solver-inputs',
    ctaLabel:
      d.chronoCalibrationCount > 0
        ? 'Manage calibrations'
        : 'Record calibration',
  });

  steps.push({
    id: 'range-session',
    title: 'Observed chrono / range session',
    required: false,
    count: d.rangeSessionCount,
    status:
      d.rangeSessionWithVelocityCount > 0
        ? 'ready'
        : d.rangeSessionCount > 0
          ? 'partial'
          : 'missing',
    why: 'Observed average velocity, ES, and SD are the engine’s primary observation. A run can be saved without them, but the velocity-only delta will be blank.',
    detail: `Log at least one range session with an average velocity. ${d.rangeSessionCount} session${d.rangeSessionCount === 1 ? '' : 's'} present, ${d.rangeSessionWithVelocityCount} with average velocity.`,
    href: '/sessions',
    ctaLabel:
      d.rangeSessionWithVelocityCount > 0
        ? 'Manage sessions'
        : d.rangeSessionCount > 0
          ? 'Edit existing session'
          : 'Log range session',
    hint:
      d.rangeSessionCount > 0 && d.rangeSessionWithVelocityCount === 0
        ? 'Sessions exist but none have an average velocity recorded yet.'
        : undefined,
  });

  steps.push({
    id: 'validation-record',
    title: 'Pressure validation reference record',
    required: false,
    count: d.validationRecordCount,
    status: d.validationRecordCount > 0 ? 'ready' : 'missing',
    why: 'A validation record captures the manufacturer reference (label, reference velocity, optional reference pressure) the run is checked against. Optional for a smoke run but required to anchor a velocity-only delta.',
    detail:
      'Create a pressure-validation record under Pressure modeling so the run has a labelled reference.',
    href: '/pressure-modeling',
    ctaLabel:
      d.validationRecordCount > 0
        ? 'Manage validation records'
        : 'Add validation record',
  });

  return steps;
}
