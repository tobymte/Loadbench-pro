'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Issue = { field?: string; code: string; message: string };

type Option = { id: string; label: string };

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
};

type Props = {
  modelVersions: Option[];
  loads: Option[];
  rangeSessions: Option[];
  validationRecords: Option[];
};

export function PressureEngineRunForm({
  modelVersions,
  loads,
  rangeSessions,
  validationRecords,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [result, setResult] = useState<RunResultOutputs | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    setResult(null);
    const form = event.currentTarget;
    const fd = new FormData(form);
    const body = {
      modelVersionId: emptyToNull(fd.get('modelVersionId')),
      loadId: emptyToNull(fd.get('loadId')),
      rangeSessionId: emptyToNull(fd.get('rangeSessionId')),
      validationRecordId: emptyToNull(fd.get('validationRecordId')),
      notes: emptyToNull(fd.get('notes')),
      acknowledgedExperimental: fd.get('acknowledgedExperimental') === 'on',
    };

    startTransition(async () => {
      const res = await fetch('/api/pressure-engine/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => ({}))) as {
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
      if (res.ok && out.outputs) {
        setResult(out.outputs);
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

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      data-testid="pressure-engine-run-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="modelVersionId">Candidate model version</label>
          <select
            id="modelVersionId"
            name="modelVersionId"
            defaultValue=""
            data-testid="pressure-engine-run-model"
          >
            <option value="">— none —</option>
            {modelVersions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
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
          <label htmlFor="loadId">Load</label>
          <select
            id="loadId"
            name="loadId"
            defaultValue=""
            data-testid="pressure-engine-run-load"
          >
            <option value="">— none —</option>
            {loads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          {issuesFor('loadId').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>
        <div>
          <label htmlFor="rangeSessionId">Range session (chrono)</label>
          <select
            id="rangeSessionId"
            name="rangeSessionId"
            defaultValue=""
            data-testid="pressure-engine-run-session"
          >
            <option value="">— none —</option>
            {rangeSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {issuesFor('rangeSessionId').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>
        <div>
          <label htmlFor="validationRecordId">Reference observation</label>
          <select
            id="validationRecordId"
            name="validationRecordId"
            defaultValue=""
            data-testid="pressure-engine-run-validation"
          >
            <option value="">— none —</option>
            {validationRecords.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          {issuesFor('validationRecordId').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Free-form context for this run. Not a safety verdict."
        />
      </div>

      <label className="flex items-start gap-2 text-[12px] text-text">
        <input
          type="checkbox"
          name="acknowledgedExperimental"
          required
          data-testid="pressure-engine-run-ack"
          className="mt-0.5"
        />
        <span>
          I understand the pressure engine does <strong>not</strong> predict
          pressure or recommend loads. This run produces only
          data-completeness, missing-field, and velocity-delta bookkeeping.
        </span>
      </label>

      {formIssues.map((i) => (
        <div
          key={`${i.code}-${i.message}`}
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
          data-testid="pressure-engine-run-form-error"
        >
          {i.message}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="pressure-engine-run-submit"
        >
          {pending ? 'Recording…' : 'Record engine run'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Pressure prediction is disabled. This run is non-operational.
        </span>
      </div>

      {result && (
        <div
          className="rounded-md border border-border bg-bg-alt px-4 py-3 text-[12px] text-text space-y-2"
          data-testid="pressure-engine-run-result"
        >
          <div className="flex items-center justify-between">
            <strong>Engine run recorded (non-operational).</strong>
            <span className="text-text-faint">
              pressurePredictionStatus:{' '}
              <code className="text-accent">
                {result.pressurePredictionStatus}
              </code>
            </span>
          </div>
          <p className="text-text-muted">
            Data completeness: {(result.dataCompleteness * 100).toFixed(0)}%.
            {result.missingFields.length > 0 && (
              <>
                {' '}
                Missing: {result.missingFields.join(', ')}.
              </>
            )}
          </p>
          {result.velocityDeltaFps != null && (
            <p className="text-text-muted">
              Velocity Δ {result.velocityDeltaFps.toFixed(1)} fps (
              {result.velocityDeltaPct?.toFixed(2) ?? '—'}%). Reference{' '}
              {result.referenceVelocityFps?.toFixed(0) ?? '—'} fps · Observed{' '}
              {result.observedVelocityFps?.toFixed(0) ?? '—'} fps.
            </p>
          )}
          {result.inputConsistencyWarnings.length > 0 && (
            <ul className="list-disc pl-5 text-text-muted">
              {result.inputConsistencyWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-text-faint">
            {result.pressurePredictionDisabledReason}
          </p>
        </div>
      )}
    </form>
  );
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = v.toString().trim();
  return s === '' ? null : s;
}
