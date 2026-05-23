'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  SIMULATION_RUN_STATUSES,
  SIMULATION_STATUS_LABEL,
  computeVelocityDelta,
  type SimulationRunStatus,
} from '@/lib/validation/simulationRun';

type Issue = { field?: string; code: string; message: string };

export type SimulationFormValidationRecord = {
  id: string;
  referenceLabel: string;
  referenceVelocityFps: number | null;
  measuredVelocityFps: number | null;
  referencePressurePsi: number | null;
};

export type SimulationFormRangeSession = {
  id: string;
  date: string;
  avgVelocityFps: number | null;
  esFps: number | null;
  sdFps: number | null;
  shotsFired: number | null;
  loadName: string | null;
};

export type SimulationFormModelVersion = {
  id: string;
  name: string;
  status: string;
};

export type SimulationFormLoad = {
  id: string;
  name: string;
};

export type SimulationFormPublishedRow = {
  id: string;
  label: string;
  velocityFps: number | null;
  chargeGr: number | null;
};

export function SimulationRunForm({
  modelVersions,
  loads,
  validationRecords,
  rangeSessions,
  publishedRows,
}: {
  modelVersions: SimulationFormModelVersion[];
  loads: SimulationFormLoad[];
  validationRecords: SimulationFormValidationRecord[];
  rangeSessions: SimulationFormRangeSession[];
  publishedRows: SimulationFormPublishedRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [validationRecordId, setValidationRecordId] = useState<string>('');
  const [rangeSessionId, setRangeSessionId] = useState<string>('');
  const [publishedRowId, setPublishedRowId] = useState<string>('');
  const [toleranceFpsInput, setToleranceFpsInput] = useState<string>('');
  const [tolerancePctInput, setTolerancePctInput] = useState<string>('');

  const selectedRecord = useMemo(
    () => validationRecords.find((r) => r.id === validationRecordId) ?? null,
    [validationRecordId, validationRecords],
  );
  const selectedSession = useMemo(
    () => rangeSessions.find((s) => s.id === rangeSessionId) ?? null,
    [rangeSessionId, rangeSessions],
  );
  const selectedPublishedRow = useMemo(
    () => publishedRows.find((r) => r.id === publishedRowId) ?? null,
    [publishedRowId, publishedRows],
  );

  const referenceFps =
    selectedRecord?.referenceVelocityFps ??
    selectedPublishedRow?.velocityFps ??
    null;
  const observedFps =
    selectedSession?.avgVelocityFps ?? selectedRecord?.measuredVelocityFps ?? null;
  const { deltaFps, deltaPct } = computeVelocityDelta(referenceFps, observedFps);

  const toleranceFps = parseFloatOrNull(toleranceFpsInput);
  const tolerancePct = parseFloatOrNull(tolerancePctInput);

  const withinTolerance = (() => {
    if (deltaFps == null) return null;
    const abs = Math.abs(deltaFps);
    const absPct = deltaPct == null ? null : Math.abs(deltaPct);
    let fpsCheck: boolean | null = null;
    let pctCheck: boolean | null = null;
    if (toleranceFps != null) fpsCheck = abs <= toleranceFps;
    if (tolerancePct != null && absPct != null) pctCheck = absPct <= tolerancePct;
    if (fpsCheck === null && pctCheck === null) return null;
    return (fpsCheck ?? true) && (pctCheck ?? true);
  })();

  const missingInputs = [
    { key: 'modelVersion', label: 'Placeholder model version', present: modelVersions.length > 0 },
    { key: 'referenceVelocity', label: 'Reference velocity (fps) from validation record or verified published row', present: referenceFps != null },
    { key: 'observedVelocity', label: 'Observed/measured velocity (fps) from chrono session or validation record', present: observedFps != null },
    { key: 'tolerance', label: 'Tolerance value (fps or %)', present: toleranceFps != null || tolerancePct != null },
    { key: 'referenceLink', label: 'Linked validation record or verified published row', present: !!validationRecordId || !!publishedRowId },
  ];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);

    const body = {
      modelVersionId: ((fd.get('modelVersionId') as string | null) ?? '').trim(),
      loadId: stringOrNull(fd.get('loadId')),
      validationRecordId: stringOrNull(fd.get('validationRecordId')),
      rangeSessionId: stringOrNull(fd.get('rangeSessionId')),
      publishedRowId: stringOrNull(fd.get('publishedRowId')),
      status: ((fd.get('status') as string | null) ?? 'DRAFT') as SimulationRunStatus,
      toleranceFps: numberOrNull(fd.get('toleranceFps')),
      tolerancePct: numberOrNull(fd.get('tolerancePct')),
      notes: stringOrNull(fd.get('notes')),
      reviewerNotes: stringOrNull(fd.get('reviewerNotes')),
      acknowledgedExperimental: fd.get('acknowledgedExperimental') === 'on',
    };

    startTransition(async () => {
      const res = await fetch('/api/simulation-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        form.reset();
        setValidationRecordId('');
        setRangeSessionId('');
        setPublishedRowId('');
        setToleranceFpsInput('');
        setTolerancePctInput('');
        router.refresh();
        return;
      }
      const out = (await res.json().catch(() => ({}))) as {
        issues?: Array<{
          path?: Array<string | number>;
          code?: string;
          message?: string;
        }>;
        error?: string;
      };
      if (Array.isArray(out.issues) && out.issues.length > 0) {
        setIssues(
          out.issues.map((i) => ({
            field: i.path?.[0]?.toString(),
            code: i.code ?? 'INVALID',
            message: i.message ?? 'Invalid value.',
          })),
        );
      } else {
        setIssues([
          {
            code: out.error ?? 'UNKNOWN',
            message: 'Could not save simulation run.',
          },
        ]);
      }
    });
  }

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      data-testid="simulation-run-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="modelVersionId">
            Placeholder model version <span className="text-accent ml-1">*</span>
          </label>
          <select
            id="modelVersionId"
            name="modelVersionId"
            required
            defaultValue=""
            data-testid="simulation-model-version"
          >
            <option value="" disabled>
              — select a model version —
            </option>
            {modelVersions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.status}
              </option>
            ))}
          </select>
          {issuesFor('modelVersionId').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>

        <div>
          <label htmlFor="status">Review status</label>
          <select
            id="status"
            name="status"
            defaultValue="DRAFT"
            data-testid="simulation-status"
          >
            {SIMULATION_RUN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SIMULATION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="loadId">Linked load (optional)</label>
          <select
            id="loadId"
            name="loadId"
            defaultValue=""
            data-testid="simulation-load"
          >
            <option value="">— none —</option>
            {loads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="validationRecordId">
            Reference / validation record (optional)
          </label>
          <select
            id="validationRecordId"
            name="validationRecordId"
            value={validationRecordId}
            onChange={(e) => setValidationRecordId(e.target.value)}
            data-testid="simulation-validation-record"
          >
            <option value="">— none —</option>
            {validationRecords.map((r) => (
              <option key={r.id} value={r.id}>
                {r.referenceLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="rangeSessionId">
            Chrono / range session (optional)
          </label>
          <select
            id="rangeSessionId"
            name="rangeSessionId"
            value={rangeSessionId}
            onChange={(e) => setRangeSessionId(e.target.value)}
            data-testid="simulation-range-session"
          >
            <option value="">— none —</option>
            {rangeSessions.map((s) => {
              const dateStr = new Date(s.date).toLocaleDateString();
              const label = s.loadName ? `${dateStr} · ${s.loadName}` : dateStr;
              const avg = s.avgVelocityFps != null ? ` · avg ${s.avgVelocityFps.toFixed(0)} fps` : '';
              return (
                <option key={s.id} value={s.id}>
                  {label}
                  {avg}
                </option>
              );
            })}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="publishedRowId">
            Verified published row (optional)
          </label>
          <select
            id="publishedRowId"
            name="publishedRowId"
            value={publishedRowId}
            onChange={(e) => setPublishedRowId(e.target.value)}
            data-testid="simulation-published-row"
          >
            <option value="">— none —</option>
            {publishedRows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-text-faint">
            Only user-verified published rows from the published-data review
            surface are listed. Published row values are used as the reference
            only when no validation record is selected.
          </p>
        </div>

        <div>
          <label htmlFor="toleranceFps">Velocity tolerance ± fps</label>
          <input
            id="toleranceFps"
            name="toleranceFps"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            placeholder="e.g. 25"
            value={toleranceFpsInput}
            onChange={(e) => setToleranceFpsInput(e.target.value)}
            data-testid="simulation-tolerance-fps"
          />
        </div>
        <div>
          <label htmlFor="tolerancePct">Velocity tolerance ± %</label>
          <input
            id="tolerancePct"
            name="tolerancePct"
            type="number"
            step="any"
            min="0"
            max="100"
            inputMode="decimal"
            placeholder="e.g. 1.5"
            value={tolerancePctInput}
            onChange={(e) => setTolerancePctInput(e.target.value)}
            data-testid="simulation-tolerance-pct"
          />
        </div>
      </div>

      <div
        className="rounded-md border border-border bg-bg-alt px-4 py-3 text-[12px] text-text"
        data-testid="simulation-comparison-summary"
      >
        <div className="font-semibold text-text mb-2">Velocity comparison</div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4">
          <dt className="text-text-muted">Reference velocity</dt>
          <dd
            className="text-text"
            data-testid="simulation-summary-ref-vel"
          >
            {referenceFps != null ? `${referenceFps.toFixed(1)} fps` : '—'}
          </dd>
          <dt className="text-text-muted">Observed velocity</dt>
          <dd
            className="text-text"
            data-testid="simulation-summary-obs-vel"
          >
            {observedFps != null ? `${observedFps.toFixed(1)} fps` : '—'}
          </dd>
          <dt className="text-text-muted">Δ fps</dt>
          <dd
            className="text-text"
            data-testid="simulation-summary-delta-fps"
          >
            {deltaFps != null ? `${deltaFps >= 0 ? '+' : ''}${deltaFps.toFixed(1)} fps` : '—'}
          </dd>
          <dt className="text-text-muted">Δ %</dt>
          <dd
            className="text-text"
            data-testid="simulation-summary-delta-pct"
          >
            {deltaPct != null ? `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%` : '—'}
          </dd>
          <dt className="text-text-muted">Within tolerance</dt>
          <dd
            className="text-text"
            data-testid="simulation-summary-within"
          >
            {withinTolerance == null
              ? '—'
              : withinTolerance
                ? 'Yes (velocity only)'
                : 'No (velocity only)'}
          </dd>
        </dl>
        {selectedRecord?.referencePressurePsi != null && (
          <p
            className="mt-3 text-[11px] text-text-faint"
            data-testid="simulation-ref-pressure-note"
          >
            Reference pressure on record: {selectedRecord.referencePressurePsi} psi —
            from user-entered / lab / published source. Not a predicted pressure;
            this app computes no pressure value.
          </p>
        )}
        <p className="mt-2 text-[11px] text-text-faint">
          Comparison is velocity only. No pressure prediction, no charge
          recommendation, no safe/unsafe label.
        </p>
      </div>

      <div
        className="rounded-md border border-border px-4 py-3 text-[12px] text-text"
        data-testid="simulation-missing-inputs"
      >
        <div className="font-semibold text-text mb-1">Missing-input checklist</div>
        <ul className="space-y-1">
          {missingInputs.map((m) => (
            <li
              key={m.key}
              className="flex items-center gap-2"
              data-testid={`simulation-missing-${m.key}`}
            >
              <span
                className={
                  m.present
                    ? 'inline-block h-2 w-2 rounded-full bg-success'
                    : 'inline-block h-2 w-2 rounded-full bg-warning'
                }
              />
              <span className={m.present ? 'text-text-muted' : 'text-text'}>
                {m.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Provenance, environment, lot notes."
          data-testid="simulation-notes"
        />
      </div>
      <div>
        <label htmlFor="reviewerNotes">Reviewer notes (optional)</label>
        <textarea
          id="reviewerNotes"
          name="reviewerNotes"
          rows={2}
          placeholder="Reviewer comments on this comparison."
          data-testid="simulation-reviewer-notes"
        />
      </div>

      <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[12px] text-text">
        <label className="flex items-start gap-2 normal-case tracking-normal text-[12px] text-text">
          <input
            type="checkbox"
            id="acknowledgedExperimental"
            name="acknowledgedExperimental"
            className="mt-[2px] !w-auto"
            data-testid="simulation-ack"
          />
          <span>
            I understand this sandbox does not calculate pressure or recommend
            loads. The record stored here is a non-operational review-state
            comparison only.
          </span>
        </label>
        {issuesFor('acknowledgedExperimental').map((i) => (
          <p key={i.code} className="text-[11px] text-danger mt-1">
            {i.message}
          </p>
        ))}
      </div>

      {formIssues.map((i) => (
        <div
          key={i.code}
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
          data-testid="simulation-form-error"
        >
          {i.message}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="simulation-submit"
        >
          {pending ? 'Saving…' : 'Save simulation run'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Stored as a velocity-comparison review record. No pressure prediction.
        </span>
      </div>
    </form>
  );
}

function parseFloatOrNull(s: string): number | null {
  const v = s.trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = v.toString().trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = v.toString().trim();
  return s === '' ? null : s;
}
