'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

// Pressure engine run builder.
//
// SAFETY: This form collects references to existing workspace records and
// submits them to the non-operational engine runner. It surfaces ONLY:
//   * data-readiness checklist (which categories are present in the inputs)
//   * input-summary preview (no pressure math)
//   * after submit: completeness, missing fields, velocity-only delta,
//     guardrail status, and the literal pressurePredictionStatus: 'disabled'.
// It never displays or sends a PSI estimate, charge recommendation, powder
// substitution, or safe/unsafe verdict.

type Issue = { field?: string; code: string; message: string };

export type BuilderModelVersion = {
  id: string;
  name: string;
  status: string;
  governanceStatus: string | null;
};

export type BuilderLoad = {
  id: string;
  name: string;
  status: string;
  chargeGr: number | null;
  cartridgeName: string | null;
  bulletLabel: string | null;
  powderLabel: string | null;
  rifleName: string | null;
  sourceTitle: string | null;
  publishedRowLabel: string | null;
  safetyAcknowledged: boolean;
};

export type BuilderRangeSession = {
  id: string;
  dateIso: string;
  avgVelocityFps: number | null;
  esFps: number | null;
  sdFps: number | null;
  shotsFired: number | null;
  loadName: string | null;
};

export type BuilderValidationRecord = {
  id: string;
  referenceLabel: string;
  referenceVelocityFps: number | null;
  measuredVelocityFps: number | null;
  referencePressurePsi: number | null;
  sourceTitle: string | null;
};

type RunResultOutputs = {
  pressurePredictionStatus: 'disabled';
  pressurePredictionDisabledReason: string;
  dataCompleteness: number;
  missingFields: string[];
  inputConsistencyWarnings: string[];
  velocityDeltaFps: number | null;
  velocityDeltaPct: number | null;
  referenceVelocityFps: number | null;
  observedVelocityFps: number | null;
  sourceCoverage?: {
    hasLinkedLoad: boolean;
    hasModelVersion: boolean;
    hasReferenceVelocity: boolean;
    hasObservedVelocity: boolean;
    hasReferencePressure: boolean;
    hasRangeSession: boolean;
  };
};

type RunCreatedRow = {
  id: string;
  status: string;
  pressurePredictionStatus: string;
  outputs: RunResultOutputs;
};

type Props = {
  modelVersions: BuilderModelVersion[];
  loads: BuilderLoad[];
  rangeSessions: BuilderRangeSession[];
  validationRecords: BuilderValidationRecord[];
  solverInputCounts: {
    caseCapacity: number;
    bulletDimensions: number;
    powderMetadata: number;
    barrelGeometry: number;
    chronoCalibration: number;
  };
};

function isPresent(v: string | null) {
  return v != null && v !== '';
}

export function PressureEngineRunBuilder({
  modelVersions,
  loads,
  rangeSessions,
  validationRecords,
  solverInputCounts,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [result, setResult] = useState<RunCreatedRow | null>(null);

  const [modelVersionId, setModelVersionId] = useState<string>('');
  const [loadId, setLoadId] = useState<string>('');
  const [rangeSessionId, setRangeSessionId] = useState<string>('');
  const [validationRecordId, setValidationRecordId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [acknowledged, setAcknowledged] = useState<boolean>(false);

  const selectedLoad = useMemo(
    () => loads.find((l) => l.id === loadId) ?? null,
    [loads, loadId],
  );
  const selectedRangeSession = useMemo(
    () => rangeSessions.find((s) => s.id === rangeSessionId) ?? null,
    [rangeSessions, rangeSessionId],
  );
  const selectedValidationRecord = useMemo(
    () =>
      validationRecords.find((v) => v.id === validationRecordId) ?? null,
    [validationRecords, validationRecordId],
  );
  const selectedModelVersion = useMemo(
    () => modelVersions.find((m) => m.id === modelVersionId) ?? null,
    [modelVersions, modelVersionId],
  );

  // Build a snapshot preview from the selected references. This is purely
  // descriptive — it does not infer pressure or recommend anything.
  const snapshotPreview = useMemo(() => {
    const referenceVelocity =
      selectedValidationRecord?.referenceVelocityFps ?? null;
    const observedVelocity =
      selectedRangeSession?.avgVelocityFps ??
      selectedValidationRecord?.measuredVelocityFps ??
      null;
    const velocityDeltaFps =
      referenceVelocity != null && observedVelocity != null
        ? observedVelocity - referenceVelocity
        : null;
    return {
      referenceVelocityFps: referenceVelocity,
      observedVelocityFps: observedVelocity,
      velocityDeltaFps,
    };
  }, [selectedRangeSession, selectedValidationRecord]);

  // Data-readiness checklist (client-side preview of what the server will
  // compute). Mirrors lib/validation/pressureEngine.runPressureEngine.
  const readiness = useMemo(() => {
    const items: Array<{ key: string; label: string; present: boolean; required: boolean }> = [
      {
        key: 'modelVersion',
        label: 'Candidate model version',
        present: !!selectedModelVersion,
        required: true,
      },
      {
        key: 'load',
        label: 'Load',
        present: !!selectedLoad,
        required: true,
      },
      {
        key: 'rangeSessionOrValidationRecord',
        label: 'Range session or validation record',
        present: !!(selectedRangeSession || selectedValidationRecord),
        required: true,
      },
      {
        key: 'referenceVelocity',
        label: 'Reference velocity (from validation record)',
        present: selectedValidationRecord?.referenceVelocityFps != null,
        required: true,
      },
      {
        key: 'observedVelocity',
        label: 'Observed velocity (chrono or measured)',
        present:
          selectedRangeSession?.avgVelocityFps != null ||
          selectedValidationRecord?.measuredVelocityFps != null,
        required: true,
      },
      {
        key: 'caseCapacity',
        label: 'Case capacity measurements',
        present: solverInputCounts.caseCapacity > 0,
        required: true,
      },
      {
        key: 'bulletDimensions',
        label: 'Bullet dimension records',
        present: solverInputCounts.bulletDimensions > 0,
        required: true,
      },
      {
        key: 'powderMetadata',
        label: 'Powder metadata records',
        present: solverInputCounts.powderMetadata > 0,
        required: true,
      },
      {
        key: 'barrelGeometry',
        label: 'Barrel geometry records',
        present: solverInputCounts.barrelGeometry > 0,
        required: true,
      },
      {
        key: 'chronoCalibration',
        label: 'Chrono calibration records',
        present: solverInputCounts.chronoCalibration > 0,
        required: true,
      },
    ];
    const presentCount = items.filter((i) => i.present).length;
    const pct = Math.round((presentCount / items.length) * 100);
    return { items, presentCount, total: items.length, pct };
  }, [
    selectedModelVersion,
    selectedLoad,
    selectedRangeSession,
    selectedValidationRecord,
    solverInputCounts,
  ]);

  const optionalLoadFields: Array<{ label: string; value: string | null }> = selectedLoad
    ? [
        { label: 'Cartridge', value: selectedLoad.cartridgeName },
        { label: 'Bullet', value: selectedLoad.bulletLabel },
        { label: 'Powder', value: selectedLoad.powderLabel },
        { label: 'Rifle', value: selectedLoad.rifleName },
        { label: 'Cited source', value: selectedLoad.sourceTitle },
        {
          label: 'Published row',
          value: selectedLoad.publishedRowLabel,
        },
        {
          label: 'Charge (gr)',
          value:
            selectedLoad.chargeGr != null
              ? selectedLoad.chargeGr.toFixed(2)
              : null,
        },
        {
          label: 'Safety acknowledged on load',
          value: selectedLoad.safetyAcknowledged ? 'yes' : 'no',
        },
      ]
    : [];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    setResult(null);

    if (!acknowledged) {
      setIssues([
        {
          field: 'acknowledgedExperimental',
          code: 'ACKNOWLEDGEMENT_REQUIRED',
          message:
            'Confirm the acknowledgement before recording the engine run.',
        },
      ]);
      return;
    }

    const body = {
      modelVersionId: modelVersionId || null,
      loadId: loadId || null,
      rangeSessionId: rangeSessionId || null,
      validationRecordId: validationRecordId || null,
      notes: notes.trim() || null,
      acknowledgedExperimental: acknowledged,
    };

    startTransition(async () => {
      let res: Response;
      try {
        res = await fetch('/api/pressure-engine/runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (e) {
        setIssues([
          {
            code: 'NETWORK',
            message:
              'Could not reach the pressure engine endpoint. Try again in a moment.',
          },
        ]);
        return;
      }
      const out = (await res.json().catch(() => ({}))) as {
        id?: string;
        status?: string;
        pressurePredictionStatus?: string;
        outputs?: RunResultOutputs;
        forbiddenKeys?: string[];
        message?: string;
        issues?: Array<{
          path?: Array<string | number>;
          code?: string;
          message?: string;
        }>;
        error?: string;
      };
      if (res.ok && out.outputs && out.id) {
        setResult({
          id: out.id,
          status: out.status ?? 'COMPLETED_NON_OPERATIONAL',
          pressurePredictionStatus:
            out.pressurePredictionStatus ?? 'disabled',
          outputs: out.outputs,
        });
        router.refresh();
        return;
      }
      if (out.error === 'FORBIDDEN_FIELDS' && out.forbiddenKeys) {
        setIssues([
          {
            code: 'FORBIDDEN_FIELDS',
            message:
              out.message ??
              `Forbidden fields rejected: ${out.forbiddenKeys.join(', ')}`,
          },
        ]);
        return;
      }
      if (out.error === 'PAYMENT_REQUIRED') {
        setIssues([
          {
            code: 'PAYMENT_REQUIRED',
            message:
              'Premium access is required to record pressure engine runs.',
          },
        ]);
        return;
      }
      if (Array.isArray(out.issues) && out.issues.length > 0) {
        setIssues(
          out.issues.map((i) => ({
            field: i.path?.[0]?.toString(),
            code: i.code ?? 'INVALID',
            message: i.message ?? 'Invalid value.',
          })),
        );
        return;
      }
      setIssues([
        {
          code: out.error ?? 'UNKNOWN',
          message: 'Could not record engine run.',
        },
      ]);
    });
  }

  const issuesFor = (field: string) =>
    issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  if (result) {
    return (
      <div
        className="space-y-4"
        data-testid="pressure-engine-run-builder-success"
      >
        <div className="rounded-md border border-success/40 bg-success-subtle px-4 py-3 text-[13px] text-text space-y-2">
          <div className="flex items-center gap-2">
            <Badge tone="success">Recorded</Badge>
            <strong className="font-semibold">
              Engine run recorded (non-operational).
            </strong>
          </div>
          <p className="text-text-muted">
            pressurePredictionStatus:{' '}
            <code className="text-accent">
              {result.pressurePredictionStatus}
            </code>{' '}
            · status: <code className="text-accent">{result.status}</code>
          </p>
          <p className="text-text-muted">
            Data completeness:{' '}
            {(result.outputs.dataCompleteness * 100).toFixed(0)}%
            {result.outputs.missingFields.length > 0 && (
              <> · missing: {result.outputs.missingFields.join(', ')}</>
            )}
          </p>
          {result.outputs.velocityDeltaFps != null && (
            <p className="text-text-muted">
              Velocity Δ {result.outputs.velocityDeltaFps.toFixed(1)} fps (
              {result.outputs.velocityDeltaPct?.toFixed(2) ?? '—'}%). Reference{' '}
              {result.outputs.referenceVelocityFps?.toFixed(0) ?? '—'} fps ·
              Observed{' '}
              {result.outputs.observedVelocityFps?.toFixed(0) ?? '—'} fps.
            </p>
          )}
          {result.outputs.inputConsistencyWarnings.length > 0 && (
            <ul className="list-disc pl-5 text-text-muted text-[12px]">
              {result.outputs.inputConsistencyWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-text-faint">
            {result.outputs.pressurePredictionDisabledReason}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => router.push(`/pressure-engine/${result.id}`)}
            data-testid="pressure-engine-run-builder-view-detail"
          >
            View run detail
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/pressure-engine')}
          >
            Back to pressure engine
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setResult(null);
              setAcknowledged(false);
            }}
          >
            Build another run
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6"
      data-testid="pressure-engine-run-builder"
    >
      <section className="space-y-3">
        <div>
          <label htmlFor="builder-modelVersionId">
            Candidate model version
          </label>
          {modelVersions.length === 0 ? (
            <BlankNotice
              message="No model versions exist yet."
              href="/pressure-modeling"
              cta="Create one on the pressure modeling test bench"
            />
          ) : (
            <select
              id="builder-modelVersionId"
              data-testid="builder-modelVersion"
              value={modelVersionId}
              onChange={(e) => setModelVersionId(e.target.value)}
            >
              <option value="">— none —</option>
              {modelVersions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.status}
                  {m.governanceStatus ? ` · ${m.governanceStatus}` : ''}
                </option>
              ))}
            </select>
          )}
          {issuesFor('modelVersionId').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>

        <div>
          <label htmlFor="builder-loadId">Load</label>
          {loads.length === 0 ? (
            <BlankNotice
              message="No loads in this workspace."
              href="/loads"
              cta="Create a load"
            />
          ) : (
            <select
              id="builder-loadId"
              data-testid="builder-load"
              value={loadId}
              onChange={(e) => setLoadId(e.target.value)}
            >
              <option value="">— none —</option>
              {loads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.status}
                  {l.cartridgeName ? ` · ${l.cartridgeName}` : ''}
                </option>
              ))}
            </select>
          )}
          {issuesFor('loadId').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>

        <div>
          <label htmlFor="builder-rangeSessionId">
            Range session (observed chrono)
          </label>
          {rangeSessions.length === 0 ? (
            <BlankNotice
              message="No range sessions recorded."
              href="/sessions"
              cta="Record a range session"
            />
          ) : (
            <select
              id="builder-rangeSessionId"
              data-testid="builder-rangeSession"
              value={rangeSessionId}
              onChange={(e) => setRangeSessionId(e.target.value)}
            >
              <option value="">— none —</option>
              {rangeSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.dateIso).toLocaleDateString()} ·{' '}
                  {s.loadName ?? 'no load'} ·{' '}
                  {s.avgVelocityFps != null
                    ? `${s.avgVelocityFps.toFixed(0)} fps avg`
                    : 'no avg'}
                  {s.sdFps != null ? ` · SD ${s.sdFps.toFixed(1)}` : ''}
                </option>
              ))}
            </select>
          )}
          {issuesFor('rangeSessionId').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>

        <div>
          <label htmlFor="builder-validationRecordId">
            Reference / validation record
          </label>
          {validationRecords.length === 0 ? (
            <BlankNotice
              message="No validation records yet."
              href="/pressure-modeling"
              cta="Create a validation record"
            />
          ) : (
            <select
              id="builder-validationRecordId"
              data-testid="builder-validationRecord"
              value={validationRecordId}
              onChange={(e) => setValidationRecordId(e.target.value)}
            >
              <option value="">— none —</option>
              {validationRecords.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.referenceLabel}
                  {v.referenceVelocityFps != null
                    ? ` · ref ${v.referenceVelocityFps.toFixed(0)} fps`
                    : ''}
                  {v.measuredVelocityFps != null
                    ? ` · measured ${v.measuredVelocityFps.toFixed(0)} fps`
                    : ''}
                </option>
              ))}
            </select>
          )}
          {issuesFor('validationRecordId').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>
      </section>

      <section
        className="rounded-md border border-border bg-bg-inset px-4 py-3 space-y-3"
        data-testid="pressure-engine-builder-snapshot"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-text-faint">
            Input snapshot preview
          </span>
          <Badge tone="neutral">Non-prescriptive</Badge>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12px]">
          <SnapshotField
            label="Model version"
            value={
              selectedModelVersion
                ? `${selectedModelVersion.name} (${selectedModelVersion.status})`
                : null
            }
          />
          <SnapshotField
            label="Load"
            value={selectedLoad ? selectedLoad.name : null}
          />
          <SnapshotField
            label="Range session"
            value={
              selectedRangeSession
                ? new Date(selectedRangeSession.dateIso).toLocaleDateString()
                : null
            }
          />
          <SnapshotField
            label="Validation record"
            value={selectedValidationRecord?.referenceLabel ?? null}
          />
          <SnapshotField
            label="Reference velocity"
            value={
              snapshotPreview.referenceVelocityFps != null
                ? `${snapshotPreview.referenceVelocityFps.toFixed(0)} fps`
                : null
            }
          />
          <SnapshotField
            label="Observed velocity"
            value={
              snapshotPreview.observedVelocityFps != null
                ? `${snapshotPreview.observedVelocityFps.toFixed(0)} fps`
                : null
            }
          />
          <SnapshotField
            label="Velocity Δ (preview)"
            value={
              snapshotPreview.velocityDeltaFps != null
                ? `${snapshotPreview.velocityDeltaFps >= 0 ? '+' : ''}${snapshotPreview.velocityDeltaFps.toFixed(1)} fps`
                : null
            }
          />
        </dl>
        {selectedLoad && (
          <details className="text-[12px] text-text-muted">
            <summary className="cursor-pointer text-text">
              Load details
            </summary>
            <dl className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
              {optionalLoadFields.map((f) => (
                <div key={f.label}>
                  <dt className="text-[10px] uppercase tracking-wider text-text-faint">
                    {f.label}
                  </dt>
                  <dd
                    className={
                      isPresent(f.value) ? 'text-text' : 'text-text-faint'
                    }
                  >
                    {isPresent(f.value) ? f.value : '—'}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </section>

      <section
        className="rounded-md border border-border bg-bg-surface px-4 py-3 space-y-3"
        data-testid="pressure-engine-builder-readiness"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-text-faint">
            Data readiness checklist
          </span>
          <Badge tone={readiness.pct === 100 ? 'success' : 'warning'}>
            {readiness.presentCount} of {readiness.total} ·{' '}
            {readiness.pct}%
          </Badge>
        </div>
        <ul className="space-y-1 text-[12px]">
          {readiness.items.map((it) => (
            <li
              key={it.key}
              className="flex items-center justify-between gap-2"
              data-testid={`builder-readiness-${it.key}`}
            >
              <span className="text-text">{it.label}</span>
              <Badge tone={it.present ? 'success' : 'warning'}>
                {it.present ? 'Present' : 'Missing'}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-text-faint">
          A missing item does not block the run — it appears in the
          missing-fields list on the recorded run. Presence is never a
          green-light for any pressure prediction.
        </p>
      </section>

      <div>
        <label htmlFor="builder-notes">Notes</label>
        <textarea
          id="builder-notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional free-form context for this run. Not a safety verdict."
          data-testid="builder-notes"
        />
      </div>

      <label
        className="flex items-start gap-2 text-[12px] text-text"
        data-testid="builder-acknowledgement"
      >
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
          data-testid="builder-acknowledgement-input"
          required
        />
        <span>
          I understand the pressure engine does <strong>not</strong> predict
          pressure or recommend loads. This run produces only
          data-completeness, missing-field, velocity-delta, and guardrail
          bookkeeping. Pressure prediction is disabled.
        </span>
      </label>

      {formIssues.length > 0 && (
        <div
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger space-y-1"
          data-testid="builder-form-error"
        >
          {formIssues.map((i) => (
            <div key={`${i.code}-${i.message}`}>{i.message}</div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="builder-submit"
        >
          {pending ? 'Recording…' : 'Save engine run'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Pressure prediction stays disabled. This is an audit row, not a
          recommendation.
        </span>
      </div>
    </form>
  );
}

function SnapshotField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-text-faint">
        {label}
      </dt>
      <dd className={value ? 'text-text' : 'text-text-faint'}>
        {value ?? '—'}
      </dd>
    </div>
  );
}

function BlankNotice({
  message,
  href,
  cta,
}: {
  message: string;
  href: string;
  cta: string;
}) {
  return (
    <div
      className="rounded-md border border-dashed border-border bg-bg-inset px-3 py-2 text-[12px] text-text-muted"
      data-testid="builder-blank-notice"
    >
      {message}{' '}
      <a
        href={href}
        className="text-accent hover:text-accent-hover underline"
      >
        {cta} →
      </a>
    </div>
  );
}
