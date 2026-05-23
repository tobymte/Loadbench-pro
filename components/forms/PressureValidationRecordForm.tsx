'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Issue = { field?: string; code: string; message: string };

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'READY_FOR_EXPERT_REVIEW', label: 'Ready for expert review' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'VALIDATED_REFERENCE', label: 'Validated reference' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

export function PressureValidationRecordForm({
  loads,
  sources,
  modelVersions,
}: {
  loads: Array<{ id: string; name: string }>;
  sources: Array<{ id: string; title: string }>;
  modelVersions: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);

    const body = {
      referenceLabel: ((fd.get('referenceLabel') as string | null) ?? '').trim(),
      loadId: stringOrNull(fd.get('loadId')),
      sourceId: stringOrNull(fd.get('sourceId')),
      modelVersionId: stringOrNull(fd.get('modelVersionId')),
      referencePressurePsi: intOrNull(fd.get('referencePressurePsi')),
      referenceVelocityFps: numberOrNull(fd.get('referenceVelocityFps')),
      measuredVelocityFps: numberOrNull(fd.get('measuredVelocityFps')),
      conditionsJson: stringOrNull(fd.get('conditionsJson')),
      status: ((fd.get('status') as string | null) ?? 'DRAFT'),
      notes: stringOrNull(fd.get('notes')),
      acknowledged: fd.get('acknowledged') === 'on',
    };

    startTransition(async () => {
      const res = await fetch('/api/pressure-modeling/validation-records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        form.reset();
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
            message: 'Could not save validation record.',
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
      data-testid="pressure-validation-record-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="referenceLabel">
            Reference label <span className="text-accent ml-1">*</span>
          </label>
          <input
            id="referenceLabel"
            name="referenceLabel"
            required
            placeholder="e.g. Hodgdon 2024 H4350 6.5CM 140gr ELD-M max"
            data-testid="pressure-validation-label"
          />
          {issuesFor('referenceLabel').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>

        <div>
          <label htmlFor="loadId">Linked load (optional)</label>
          <select
            id="loadId"
            name="loadId"
            defaultValue=""
            data-testid="pressure-validation-load"
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
          <label htmlFor="sourceId">Linked source (optional)</label>
          <select id="sourceId" name="sourceId" defaultValue="">
            <option value="">— none —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="modelVersionId">Linked model version (optional)</label>
          <select
            id="modelVersionId"
            name="modelVersionId"
            defaultValue=""
          >
            <option value="">— none —</option>
            {modelVersions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue="DRAFT">
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="referencePressurePsi">
            Reference pressure (psi)
          </label>
          <input
            id="referencePressurePsi"
            name="referencePressurePsi"
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
            placeholder="from published / lab data"
            data-testid="pressure-validation-ref-psi"
          />
          {issuesFor('referencePressurePsi').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>
        <div>
          <label htmlFor="referenceVelocityFps">
            Reference velocity (fps)
          </label>
          <input
            id="referenceVelocityFps"
            name="referenceVelocityFps"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            placeholder="from published / lab data"
          />
        </div>
        <div>
          <label htmlFor="measuredVelocityFps">
            Measured velocity (fps)
          </label>
          <input
            id="measuredVelocityFps"
            name="measuredVelocityFps"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            placeholder="from your chrono"
          />
        </div>
      </div>

      <div>
        <label htmlFor="conditionsJson">Conditions (JSON)</label>
        <textarea
          id="conditionsJson"
          name="conditionsJson"
          rows={3}
          placeholder='{"tempF":60,"humidityPct":35,"pressureInHg":29.92}'
        />
      </div>
      <div>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Provenance, page numbers, lab method, lot identifiers."
        />
      </div>

      <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[12px] text-text">
        <label className="flex items-start gap-2 normal-case tracking-normal text-[12px] text-text">
          <input
            type="checkbox"
            id="acknowledged"
            name="acknowledged"
            className="mt-[2px] !w-auto"
            data-testid="pressure-validation-ack"
          />
          <span>
            I understand this is experimental validation data only. This entry
            is not a load recommendation, not a safe/unsafe claim, and is not
            interpreted by any pressure solver in this app.
          </span>
        </label>
        {issuesFor('acknowledged').map((i) => (
          <p key={i.code} className="text-[11px] text-danger mt-1">
            {i.message}
          </p>
        ))}
      </div>

      {formIssues.map((i) => (
        <div
          key={i.code}
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
        >
          {i.message}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="pressure-validation-submit"
        >
          {pending ? 'Saving…' : 'Save validation record'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Stored as a structured note. No pressure prediction is computed.
        </span>
      </div>
    </form>
  );
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = v.toString().trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = numberOrNull(v);
  if (n === null) return null;
  return Math.trunc(n);
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = v.toString().trim();
  return s === '' ? null : s;
}
