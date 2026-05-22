'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

type Issue = { field?: string; code: string; message: string };
type Option = { value: string; label: string };

export type SessionFormOptions = {
  loads: Option[];
  rifles: Option[];
};

export function SessionForm({ options }: { options: SessionFormOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);

    const body = {
      loadId: stringOrNull(fd.get('loadId')),
      rifleId: stringOrNull(fd.get('rifleId')),
      date: stringOrNull(fd.get('date')),
      location: stringOrNull(fd.get('location')),
      tempF: numberOrNull(fd.get('tempF')),
      humidityPct: numberOrNull(fd.get('humidityPct')),
      pressureInHg: numberOrNull(fd.get('pressureInHg')),
      windMph: numberOrNull(fd.get('windMph')),
      shotsFired: intOrNull(fd.get('shotsFired')),
      avgVelocityFps: numberOrNull(fd.get('avgVelocityFps')),
      esFps: numberOrNull(fd.get('esFps')),
      sdFps: numberOrNull(fd.get('sdFps')),
      groupSizeIn: numberOrNull(fd.get('groupSizeIn')),
      notes: stringOrNull(fd.get('notes')),
    };

    startTransition(async () => {
      const res = await fetch('/api/sessions', {
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
        issues?: Array<{ path?: Array<string | number>; code?: string; message?: string }>;
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
          { code: out.error ?? 'UNKNOWN', message: 'Could not save range session.' },
        ]);
      }
    });
  }

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  const today = new Date();
  const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <Card>
      <CardHeader
        title="Log a range session"
        description="Record what you shot, when, where, and the conditions. Session observations are records only — LoadBench Pro does not certify safety or interpret your data."
      />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4" data-testid="session-form">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="date">
                Date<span className="text-accent ml-1">*</span>
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={isoToday}
                required
                data-testid="session-date"
              />
              {issuesFor('date').map((i) => (
                <p key={i.code} className="text-[11px] text-danger mt-1">
                  {i.message}
                </p>
              ))}
            </div>
            <SelectField
              label="Load"
              name="loadId"
              options={[{ value: '', label: '— None —' }, ...options.loads]}
              issues={issuesFor('loadId')}
              testId="session-load"
            />
            <SelectField
              label="Rifle"
              name="rifleId"
              options={[{ value: '', label: '— None —' }, ...options.rifles]}
              issues={issuesFor('rifleId')}
            />
            <Field label="Location" name="location" placeholder="e.g. home range" issues={issuesFor('location')} />
            <Field
              label="Temp (°F)"
              name="tempF"
              type="number"
              step="0.1"
              inputMode="decimal"
              issues={issuesFor('tempF')}
            />
            <Field
              label="Humidity (%)"
              name="humidityPct"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              issues={issuesFor('humidityPct')}
            />
            <Field
              label="Pressure (inHg)"
              name="pressureInHg"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              issues={issuesFor('pressureInHg')}
            />
            <Field
              label="Wind (mph)"
              name="windMph"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              issues={issuesFor('windMph')}
            />
            <Field
              label="Shots fired"
              name="shotsFired"
              type="number"
              step="1"
              min="0"
              inputMode="numeric"
              issues={issuesFor('shotsFired')}
            />
            <Field
              label="Avg velocity (fps)"
              name="avgVelocityFps"
              type="number"
              step="1"
              min="0"
              inputMode="decimal"
              issues={issuesFor('avgVelocityFps')}
            />
            <Field
              label="ES (fps)"
              name="esFps"
              type="number"
              step="1"
              min="0"
              inputMode="decimal"
              issues={issuesFor('esFps')}
            />
            <Field
              label="SD (fps)"
              name="sdFps"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              issues={issuesFor('sdFps')}
            />
            <Field
              label="Group size (in)"
              name="groupSizeIn"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              issues={issuesFor('groupSizeIn')}
            />
          </div>

          <div>
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={3} />
            {issuesFor('notes').map((i) => (
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

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={pending} data-testid="session-submit">
              {pending ? 'Saving…' : 'Save session'}
            </Button>
            <span className="text-[11px] text-text-faint">
              Session observations are records only — LoadBench Pro does not
              interpret your data or recommend changes.
            </span>
          </div>
        </form>
      </CardBody>
    </Card>
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

function Field({
  label,
  name,
  required,
  type = 'text',
  step,
  min,
  inputMode,
  placeholder,
  issues,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  step?: string;
  min?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  placeholder?: string;
  issues: Issue[];
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        min={min}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
      />
      {issues.map((i) => (
        <p key={i.code} className="text-[11px] text-danger mt-1">
          {i.message}
        </p>
      ))}
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  issues,
  testId,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  issues: Issue[];
  testId?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue="" data-testid={testId}>
        {options.map((o) => (
          <option key={o.value || '__empty__'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {issues.map((i) => (
        <p key={i.code} className="text-[11px] text-danger mt-1">
          {i.message}
        </p>
      ))}
    </div>
  );
}
