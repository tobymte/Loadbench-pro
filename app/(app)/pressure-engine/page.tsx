import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { PaywallNotice } from '@/components/billing/PaywallNotice';
import { FEATURE_KEYS, getEntitlement } from '@/lib/billing/entitlements';
import { isBigCommerceConfigured } from '@/lib/billing/bigcommerce';
import { PressureEngineRunForm } from '@/components/forms/PressureEngineRunForm';
import {
  PRESSURE_ENGINE_STATUS_LABEL,
  PRESSURE_PREDICTION_DISABLED_REASON,
  type PressureEngineRunStatus,
} from '@/lib/validation/pressureEngine';

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
// route handlers it calls.

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

export default async function PressureEnginePage() {
  const ctx = await getWorkspaceContext();
  const entitlement = await getEntitlement(
    ctx.workspaceId,
    FEATURE_KEYS.PRESSURE_MODELING,
  );
  const bigcommerceConfigured = isBigCommerceConfigured();

  if (!entitlement.hasAccess) {
    return (
      <>
        <Topbar
          title="Pressure engine"
          actions={<Badge tone="accent">Premium</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
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
          <PaywallNotice
            entitlement={entitlement}
            bigcommerceConfigured={bigcommerceConfigured}
            title="Premium: pressure engine workspace"
            description="Paid access unlocks the controlled validation workspace and a future model slot. It does not turn LoadBench Pro into a load recommender — no PSI, peak pressure, charge advice, or safe/unsafe verdict is ever produced."
            featureBullets={[
              'Non-operational engine runner that records data completeness, missing fields, and velocity-only deltas for audit.',
              'Model governance fields (governance status, blocked-outputs policy, validation notes) on each candidate pressure model version.',
              'Engine run history / audit view for input completeness and velocity comparisons over time.',
              'Hard server-side guardrails reject any request that includes predictedPressurePsi, recommendedCharge, safe/unsafe, powderSubstitution, or related forbidden keys.',
            ]}
          />
        </div>
      </>
    );
  }

  const [
    modelVersions,
    loads,
    rangeSessions,
    validationRecords,
    engineRuns,
  ] = await Promise.all([
    prisma.pressureModelVersion.findMany({
      where: { workspaceId: ctx.workspaceId },
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
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.rangeSession.findMany({
      where: { workspaceId: ctx.workspaceId },
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
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        referenceLabel: true,
        referenceVelocityFps: true,
      },
    }),
    prisma.pressureEngineRun.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        modelVersion: { select: { id: true, name: true } },
        load: { select: { id: true, name: true } },
        rangeSession: { select: { id: true, date: true } },
        validationRecord: { select: { id: true, referenceLabel: true } },
      },
    }),
  ]);

  return (
    <>
      <Topbar
        title="Pressure engine"
        actions={<Badge tone="warning">Non-operational</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
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
            for validation infrastructure.
          </p>
        </div>

        <Card>
          <CardHeader
            title="Run the engine (non-operational)"
            description="Select a candidate model version, a load, and any chrono / reference observations. The engine records data completeness, missing fields, source coverage, input-consistency warnings, and a velocity-only delta. It does not produce a pressure estimate or charge advice."
            actions={<Badge tone="warning">Acknowledgement required</Badge>}
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
          <CardHeader
            title="Model governance"
            description="Each candidate pressure model version records a governance status, blocked-outputs policy, and validation notes. These are documentation — the engine never executes a model."
          />
          <CardBody>
            {modelVersions.length === 0 ? (
              <p
                className="text-[12px] text-text-muted"
                data-testid="pressure-engine-no-model-versions"
              >
                No model versions recorded yet. Create one on the{' '}
                <Link
                  href="/pressure-modeling"
                  className="text-accent hover:text-accent-hover"
                >
                  pressure modeling test bench
                </Link>
                .
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table data-testid="pressure-engine-model-governance-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Review status</th>
                      <th>Governance</th>
                      <th>Blocked outputs policy</th>
                      <th>Validation notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelVersions.map((m) => (
                      <tr key={m.id}>
                        <td className="text-text">{m.name}</td>
                        <td>
                          <Badge tone="neutral">{m.status}</Badge>
                        </td>
                        <td className="text-text-muted">
                          {m.governanceStatus ?? '—'}
                        </td>
                        <td className="text-text-muted text-[12px]">
                          {m.blockedOutputsPolicy ?? '—'}
                        </td>
                        <td className="text-text-muted text-[12px]">
                          {m.validationNotes ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-text-faint">
                  Governance status is documentation only. Engine runs remain
                  non-operational regardless of the value here.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Engine run history"
            description="Audit / history view: input completeness, source coverage, and velocity-only comparisons over time. PSI / pressure / charge outputs are intentionally absent from every row."
            actions={<Badge tone="neutral">Audit-only</Badge>}
          />
          <CardBody>
            {engineRuns.length === 0 ? (
              <p
                className="text-[12px] text-text-muted"
                data-testid="pressure-engine-history-empty"
              >
                No engine runs recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table data-testid="pressure-engine-history-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Status</th>
                      <th>Prediction</th>
                      <th>Model</th>
                      <th>Load</th>
                      <th>Range session</th>
                      <th>Reference</th>
                      <th>Velocity Δ</th>
                      <th>Completeness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineRuns.map((r) => {
                      const outputs = parseOutputs(r.outputsJson);
                      return (
                        <tr key={r.id}>
                          <td className="text-text-faint">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                          <td>
                            <Badge
                              tone={statusTone(
                                r.status as PressureEngineRunStatus,
                              )}
                            >
                              {PRESSURE_ENGINE_STATUS_LABEL[
                                r.status as PressureEngineRunStatus
                              ]}
                            </Badge>
                          </td>
                          <td>
                            <code className="text-[11px] text-accent">
                              {r.pressurePredictionStatus}
                            </code>
                          </td>
                          <td className="text-text-muted">
                            {r.modelVersion?.name ?? '—'}
                          </td>
                          <td className="text-text-muted">
                            {r.load?.name ?? '—'}
                          </td>
                          <td className="text-text-muted">
                            {r.rangeSession
                              ? new Date(
                                  r.rangeSession.date,
                                ).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="text-text-muted">
                            {r.validationRecord?.referenceLabel ?? '—'}
                          </td>
                          <td className="text-text-muted">
                            {r.velocityDeltaFps != null
                              ? `${r.velocityDeltaFps >= 0 ? '+' : ''}${r.velocityDeltaFps.toFixed(1)} fps`
                              : '—'}
                          </td>
                          <td className="text-text-muted">
                            {outputs?.dataCompleteness != null
                              ? `${(outputs.dataCompleteness * 100).toFixed(0)}%`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-text-faint">
                  Every row in this history carries{' '}
                  <code className="text-accent">
                    pressurePredictionStatus = &quot;disabled&quot;
                  </code>
                  . This audit log exists so future reviewers can confirm no
                  run ever produced a pressure prediction or charge advice.
                </p>
              </div>
            )}
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
};

function parseOutputs(raw: string | null): ParsedOutputs | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedOutputs;
  } catch {
    return null;
  }
}
