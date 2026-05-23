import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  PRESSURE_ENGINE_STATUS_LABEL,
  PRESSURE_PREDICTION_DISABLED_REASON,
  type PressureEngineRunStatus,
} from '@/lib/validation/pressureEngine';

// Pressure engine display scaffolding.
//
// SAFETY: Every visible section here is display-only. No prediction, PSI
// estimate, charge advice, safe/unsafe verdict, powder substitution, or any
// other forbidden output appears anywhere in this file. The reserved
// "Internal chamber pressure model output" panel is intentionally inert and
// states why.

export type DashboardWorkspaceSummary = {
  loads: number;
  cartridges: number;
  components: number;
  rifles: number;
  sources: number;
  rangeSessions: number;
  validationRecords: number;
  modelVersions: number;
  caseCapacityMeasurements: number;
  bulletDimensionRecords: number;
  powderMetadataRecords: number;
  barrelGeometryRecords: number;
  chronoCalibrationRecords: number;
  publishedRowsVerified: number;
  publishedRowsTotal: number;
  engineRuns: number;
};

export type DashboardEngineRunRow = {
  id: string;
  createdAt: Date;
  status: PressureEngineRunStatus;
  pressurePredictionStatus: string;
  velocityDeltaFps: number | null;
  velocityDeltaPct: number | null;
  modelName: string | null;
  loadName: string | null;
  rangeSessionDate: Date | null;
  validationLabel: string | null;
  dataCompleteness: number | null;
  missingFields: string[];
  inputConsistencyWarnings: string[];
  sourceCoverage: {
    hasLinkedLoad: boolean;
    hasModelVersion: boolean;
    hasReferenceVelocity: boolean;
    hasObservedVelocity: boolean;
    hasReferencePressure: boolean;
    hasRangeSession: boolean;
  } | null;
};

export type DashboardModelGovernanceRow = {
  id: string;
  name: string;
  status: string;
  governanceStatus: string | null;
  blockedOutputsPolicy: string | null;
  validationNotes: string | null;
};

type Props = {
  summary: DashboardWorkspaceSummary;
  runs: DashboardEngineRunRow[];
  modelVersions: DashboardModelGovernanceRow[];
};

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

function ReadinessRow({
  label,
  value,
  href,
  helper,
}: {
  label: string;
  value: number;
  href?: string;
  helper?: string;
}) {
  const present = value > 0;
  return (
    <li
      className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-b-0"
      data-testid={`readiness-row-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="min-w-0">
        <div className="text-[13px] text-text">{label}</div>
        {helper && (
          <p className="mt-0.5 text-[11px] text-text-faint leading-snug">
            {helper}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] tabular-nums text-text-muted">
          {value} record{value === 1 ? '' : 's'}
        </span>
        <Badge tone={present ? 'success' : 'warning'}>
          {present ? 'Present' : 'Missing'}
        </Badge>
        {href && (
          <Link
            href={href}
            className="text-[11px] text-accent hover:text-accent-hover"
          >
            Open →
          </Link>
        )}
      </div>
    </li>
  );
}

function CoverageDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px]"
      title={label}
    >
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

export function PressureEngineDashboard({
  summary,
  runs,
  modelVersions,
}: Props) {
  const totalReadiness =
    Number(summary.loads > 0) +
    Number(summary.cartridges > 0) +
    Number(summary.components > 0) +
    Number(summary.rifles > 0) +
    Number(summary.sources > 0) +
    Number(summary.rangeSessions > 0) +
    Number(summary.validationRecords > 0) +
    Number(summary.modelVersions > 0) +
    Number(summary.caseCapacityMeasurements > 0) +
    Number(summary.bulletDimensionRecords > 0) +
    Number(summary.powderMetadataRecords > 0) +
    Number(summary.barrelGeometryRecords > 0) +
    Number(summary.chronoCalibrationRecords > 0);
  const totalChecks = 13;
  const readinessPct = Math.round((totalReadiness / totalChecks) * 100);

  return (
    <div className="space-y-6" data-testid="pressure-engine-dashboard">
      {/* Reserved/disabled prediction output panel */}
      <Card
        className="border-danger/40"
        data-testid="pressure-engine-reserved-output"
      >
        <CardHeader
          title="Internal chamber pressure model output"
          description="Reserved display slot for a future, expert-validated internal-ballistics model. This panel intentionally shows no predicted pressure, no PSI value, no charge recommendation, and no safe/unsafe verdict."
          actions={<Badge tone="danger">Disabled</Badge>}
        />
        <CardBody className="space-y-3">
          <div
            className="rounded-md border border-danger/40 bg-danger-subtle/40 px-3 py-2 text-[12px] text-text"
            data-testid="reserved-output-disabled-banner"
          >
            <strong className="font-semibold">
              Predictions are disabled.
            </strong>{' '}
            No internal chamber pressure value is calculated or displayed.
            Enablement is gated on: (a) a validated lab model, (b) SAAMI / CIP
            / manufacturer data review, (c) legal and safety review, and (d)
            instrumented test validation. None of those gates are currently
            passed.
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
            <div className="rounded-md border border-border bg-bg-inset px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                Validated lab model
              </dt>
              <dd className="mt-1">
                <Badge tone="danger">Not approved</Badge>
              </dd>
            </div>
            <div className="rounded-md border border-border bg-bg-inset px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                SAAMI / CIP review
              </dt>
              <dd className="mt-1">
                <Badge tone="danger">Pending</Badge>
              </dd>
            </div>
            <div className="rounded-md border border-border bg-bg-inset px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                Legal / safety review
              </dt>
              <dd className="mt-1">
                <Badge tone="danger">Pending</Badge>
              </dd>
            </div>
            <div className="rounded-md border border-border bg-bg-inset px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                Instrumented test data
              </dt>
              <dd className="mt-1">
                <Badge tone="danger">Pending</Badge>
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-text-faint leading-relaxed">
            {PRESSURE_PREDICTION_DISABLED_REASON}
          </p>
        </CardBody>
      </Card>

      {/* Workspace overview tiles */}
      <section
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        data-testid="pressure-engine-overview-tiles"
      >
        <OverviewTile
          label="Engine runs"
          value={summary.engineRuns}
          hint="Non-operational"
        />
        <OverviewTile
          label="Model versions"
          value={summary.modelVersions}
          hint="Governance"
        />
        <OverviewTile
          label="Validation records"
          value={summary.validationRecords}
          hint="Reference"
        />
        <OverviewTile
          label="Range sessions"
          value={summary.rangeSessions}
          hint="Chrono"
        />
      </section>

      {/* Data-readiness checklist */}
      <Card>
        <CardHeader
          title="Solver-input data readiness"
          description="Required input records for a future, expert-validated solver. The list reports what is present or missing in this workspace today. Presence is not a green-light to enable a model."
          actions={
            <Badge tone={readinessPct === 100 ? 'success' : 'warning'}>
              {readinessPct}% present
            </Badge>
          }
        />
        <CardBody>
          <ul className="text-[13px]" data-testid="solver-input-readiness-list">
            <ReadinessRow
              label="Input completeness — cartridges"
              value={summary.cartridges}
              href="/cartridges"
              helper="Cartridge reference rows (case capacity, MAP, bullet diameter)."
            />
            <ReadinessRow
              label="Case capacity measurements"
              value={summary.caseCapacityMeasurements}
              href="/solver-inputs"
              helper="User-entered water-fill or alcohol-fill capacity for cases."
            />
            <ReadinessRow
              label="Bullet dimension records"
              value={summary.bulletDimensionRecords}
              href="/solver-inputs"
              helper="Weight, diameter, bearing surface, ogive, BC samples."
            />
            <ReadinessRow
              label="Powder metadata records"
              value={summary.powderMetadataRecords}
              href="/solver-inputs"
              helper="Manufacturer, burn-rate label, lot, density, temp-sensitivity notes."
            />
            <ReadinessRow
              label="Barrel geometry records"
              value={summary.barrelGeometryRecords}
              href="/solver-inputs"
              helper="Length, twist, bore/groove, throat, freebore, land count."
            />
            <ReadinessRow
              label="Chrono calibration records"
              value={summary.chronoCalibrationRecords}
              href="/solver-inputs"
              helper="Device, reference / observed velocity, offset, conditions."
            />
            <ReadinessRow
              label="Published / reference source coverage"
              value={summary.sources}
              href="/sources"
              helper="Cited published references (manuals, manufacturer data)."
            />
            <ReadinessRow
              label="Published-row drafts verified"
              value={summary.publishedRowsVerified}
              href="/published-data-review"
              helper={`Verified / total: ${summary.publishedRowsVerified} of ${summary.publishedRowsTotal} transcribed published rows.`}
            />
            <ReadinessRow
              label="Observed velocity — range sessions"
              value={summary.rangeSessions}
              href="/sessions"
              helper="Sessions with chrono avg / ES / SD that can pair with reference velocities."
            />
            <ReadinessRow
              label="Reference velocity / pressure — validation records"
              value={summary.validationRecords}
              href="/pressure-modeling"
              helper="User-entered reference rows from published or lab sources. Pressure here is always user-entered, never computed."
            />
            <ReadinessRow
              label="Model version / governance status"
              value={summary.modelVersions}
              href="/pressure-modeling"
              helper="Candidate model identities with governance status and blocked-outputs policy."
            />
            <ReadinessRow
              label="Loads catalog"
              value={summary.loads}
              href="/loads"
              helper="Recorded loads with cited published source and acknowledged safety check."
            />
            <ReadinessRow
              label="Rifles catalog"
              value={summary.rifles}
              href="/rifles"
              helper="Rifle records, barrel length, twist, optic notes."
            />
          </ul>
        </CardBody>
      </Card>

      {/* Guardrail status */}
      <Card>
        <CardHeader
          title="Engine guardrail status"
          description="Hard server-side guardrails reject any request or response that includes forbidden prediction or advice keys. Audit fields on every persisted run prove no prediction was emitted."
          actions={<Badge tone="success">Enforced</Badge>}
        />
        <CardBody>
          <ul
            className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] text-text"
            data-testid="guardrail-status-list"
          >
            <li className="flex items-start gap-2">
              <Badge tone="success">On</Badge>
              <span>
                Forbidden-output key list rejects inbound bodies containing{' '}
                <code className="text-accent">predictedPressurePsi</code>,{' '}
                <code className="text-accent">peakPressure</code>,{' '}
                <code className="text-accent">recommendedCharge</code>,{' '}
                <code className="text-accent">safe</code> /{' '}
                <code className="text-accent">unsafe</code>, or powder
                substitutions.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Badge tone="success">On</Badge>
              <span>
                Outbound responses are stripped of any forbidden key before
                serialization (defence in depth).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Badge tone="success">On</Badge>
              <span>
                Every persisted run records{' '}
                <code className="text-accent">
                  pressurePredictionStatus = &quot;disabled&quot;
                </code>{' '}
                for historical audit.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Badge tone="success">On</Badge>
              <span>
                Acknowledgement-required check rejects runs unless the caller
                confirms the engine does not predict pressure or recommend
                loads.
              </span>
            </li>
          </ul>
        </CardBody>
      </Card>

      {/* Model governance */}
      <Card>
        <CardHeader
          title="Model version / governance status"
          description="Candidate model identities recorded for this workspace. Governance status is documentation; the runner never executes a model."
        />
        <CardBody>
          {modelVersions.length === 0 ? (
            <p
              className="text-[12px] text-text-muted"
              data-testid="pressure-engine-no-model-versions"
            >
              No model versions recorded yet.{' '}
              <Link
                href="/pressure-modeling"
                className="text-accent hover:text-accent-hover"
              >
                Create one on the pressure modeling test bench
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

      {/* Run history */}
      <Card>
        <CardHeader
          title="Engine run history"
          description="Audit log of past engine runs. Each row shows only allowed outputs: input completeness, missing fields, velocity delta (fps + %), source coverage, warnings, and disabled prediction status."
          actions={<Badge tone="neutral">Audit-only</Badge>}
        />
        <CardBody>
          {runs.length === 0 ? (
            <p
              className="text-[12px] text-text-muted"
              data-testid="pressure-engine-history-empty"
            >
              No engine runs recorded yet.
            </p>
          ) : (
            <div className="space-y-3" data-testid="pressure-engine-history-list">
              {runs.map((r) => (
                <details
                  key={r.id}
                  className="rounded-md border border-border bg-bg-inset"
                  data-testid={`engine-run-detail-${r.id}`}
                >
                  <summary className="cursor-pointer list-none px-3 py-2 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="text-text-faint tabular-nums">
                      {r.createdAt.toLocaleString()}
                    </span>
                    <Badge tone={statusTone(r.status)}>
                      {PRESSURE_ENGINE_STATUS_LABEL[r.status]}
                    </Badge>
                    <code className="text-[11px] text-accent">
                      {r.pressurePredictionStatus}
                    </code>
                    {r.modelName && (
                      <span className="text-text-muted">
                        model · {r.modelName}
                      </span>
                    )}
                    {r.loadName && (
                      <span className="text-text-muted">
                        load · {r.loadName}
                      </span>
                    )}
                    <span className="ml-auto text-text-muted">
                      {r.dataCompleteness != null
                        ? `${(r.dataCompleteness * 100).toFixed(0)}% complete`
                        : '—'}
                    </span>
                    <span className="text-text-muted">
                      {r.velocityDeltaFps != null
                        ? `Δ ${r.velocityDeltaFps >= 0 ? '+' : ''}${r.velocityDeltaFps.toFixed(1)} fps${
                            r.velocityDeltaPct != null
                              ? ` (${r.velocityDeltaPct >= 0 ? '+' : ''}${r.velocityDeltaPct.toFixed(2)}%)`
                              : ''
                          }`
                        : 'Δ —'}
                    </span>
                    <Link
                      href={`/pressure-engine/${r.id}`}
                      className="text-[11px] text-accent hover:text-accent-hover"
                      data-testid={`engine-run-open-${r.id}`}
                    >
                      Open →
                    </Link>
                  </summary>
                  <div className="border-t border-border px-3 py-3 space-y-3 text-[12px]">
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                          Range session
                        </dt>
                        <dd className="text-text-muted">
                          {r.rangeSessionDate
                            ? r.rangeSessionDate.toLocaleDateString()
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                          Validation record
                        </dt>
                        <dd className="text-text-muted">
                          {r.validationLabel ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                          Prediction status
                        </dt>
                        <dd>
                          <code className="text-accent">
                            {r.pressurePredictionStatus}
                          </code>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                          Data completeness
                        </dt>
                        <dd className="text-text-muted">
                          {r.dataCompleteness != null
                            ? `${(r.dataCompleteness * 100).toFixed(0)}%`
                            : '—'}
                        </dd>
                      </div>
                    </dl>

                    {r.sourceCoverage && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
                          Source coverage
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <CoverageDot
                            on={r.sourceCoverage.hasLinkedLoad}
                            label="Linked load"
                          />
                          <CoverageDot
                            on={r.sourceCoverage.hasModelVersion}
                            label="Model version"
                          />
                          <CoverageDot
                            on={r.sourceCoverage.hasRangeSession}
                            label="Range session"
                          />
                          <CoverageDot
                            on={r.sourceCoverage.hasReferenceVelocity}
                            label="Reference velocity"
                          />
                          <CoverageDot
                            on={r.sourceCoverage.hasObservedVelocity}
                            label="Observed velocity"
                          />
                          <CoverageDot
                            on={r.sourceCoverage.hasReferencePressure}
                            label="Reference pressure (user-entered)"
                          />
                        </div>
                      </div>
                    )}

                    {r.missingFields.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
                          Missing fields
                        </div>
                        <ul className="flex flex-wrap gap-1">
                          {r.missingFields.map((f) => (
                            <li key={f}>
                              <Badge tone="warning">{f}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.inputConsistencyWarnings.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
                          Input-consistency warnings
                        </div>
                        <ul className="list-disc pl-5 text-text-muted space-y-1">
                          {r.inputConsistencyWarnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-[11px] text-text-faint">
                      This row is audit-only. No PSI, peak pressure, charge
                      recommendation, or safe/unsafe verdict is stored or
                      displayed for this run.
                    </p>
                  </div>
                </details>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function OverviewTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4">
      <div className="text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-lg font-semibold text-text tabular-nums">
          {value}
        </div>
        <div className="text-[10px] text-text-muted uppercase tracking-wider">
          {hint}
        </div>
      </div>
    </div>
  );
}
