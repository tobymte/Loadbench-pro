'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

type Issue = { field?: string; code: string; message: string };

export function CartridgeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);

    const body = {
      name: ((fd.get('name') as string | null) ?? '').trim(),
      saami: stringOrNull(fd.get('saami')),
      bulletDiameterIn: numberOrNull(fd.get('bulletDiameterIn')),
      caseCapacityGrH2O: numberOrNull(fd.get('caseCapacityGrH2O')),
      maxPressurePsi: intOrNull(fd.get('maxPressurePsi')),
      notes: stringOrNull(fd.get('notes')),
    };

    startTransition(async () => {
      const res = await fetch('/api/cartridges', {
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
          { code: out.error ?? 'UNKNOWN', message: 'Could not save cartridge.' },
        ]);
      }
    });
  }

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  return (
    <Card>
      <CardHeader
        title="Add a cartridge"
        description="Reference data only. LoadBench Pro does not validate or recommend loads — values you record here are the figures you cite from a published source."
      />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Name"
              name="name"
              required
              placeholder="e.g. 6.5 Creedmoor"
              issues={issuesFor('name')}
            />
            <Field
              label="SAAMI / CIP designation"
              name="saami"
              placeholder="optional"
              issues={issuesFor('saami')}
            />
            <Field
              label="Bullet diameter (in)"
              name="bulletDiameterIn"
              type="number"
              step="0.0001"
              min="0"
              inputMode="decimal"
              placeholder="e.g. 0.264"
              issues={issuesFor('bulletDiameterIn')}
            />
            <Field
              label="Case capacity (gr H₂O)"
              name="caseCapacityGrH2O"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              placeholder="optional"
              issues={issuesFor('caseCapacityGrH2O')}
            />
            <Field
              label="Max pressure (psi)"
              name="maxPressurePsi"
              type="number"
              step="1"
              min="0"
              inputMode="numeric"
              placeholder="published MAP"
              issues={issuesFor('maxPressurePsi')}
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
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save cartridge'}
            </Button>
            <span className="text-[11px] text-text-faint">
              Values you enter are reference data only — they are not used to
              validate any load.
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
