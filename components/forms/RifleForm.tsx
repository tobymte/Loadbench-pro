'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

type Issue = { field?: string; code: string; message: string };
type Option = { value: string; label: string };

export type RifleFormOptions = {
  cartridges: Option[];
};

export function RifleForm({ options }: { options: RifleFormOptions }) {
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
      manufacturer: stringOrNull(fd.get('manufacturer')),
      model: stringOrNull(fd.get('model')),
      cartridgeId: stringOrNull(fd.get('cartridgeId')),
      barrelLengthIn: numberOrNull(fd.get('barrelLengthIn')),
      twistRate: stringOrNull(fd.get('twistRate')),
      opticNotes: stringOrNull(fd.get('opticNotes')),
      zeroDistanceYd: numberOrNull(fd.get('zeroDistanceYd')),
      notes: stringOrNull(fd.get('notes')),
    };

    startTransition(async () => {
      const res = await fetch('/api/rifles', {
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
          { code: out.error ?? 'UNKNOWN', message: 'Could not save rifle.' },
        ]);
      }
    });
  }

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  return (
    <Card>
      <CardHeader
        title="Add a rifle"
        description="Profile a rifle in your workspace. Recordkeeping only — these values are observations and reference notes, not load-safety predictions."
      />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4" data-testid="rifle-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Name"
              name="name"
              required
              placeholder='e.g. "Tikka T3x 6.5 CM"'
              issues={issuesFor('name')}
              testId="rifle-name"
            />
            <SelectField
              label="Cartridge / chambering"
              name="cartridgeId"
              options={[{ value: '', label: '— None —' }, ...options.cartridges]}
              issues={issuesFor('cartridgeId')}
              testId="rifle-cartridge"
            />
            <Field
              label="Manufacturer"
              name="manufacturer"
              placeholder="optional"
              issues={issuesFor('manufacturer')}
            />
            <Field
              label="Model"
              name="model"
              placeholder="optional"
              issues={issuesFor('model')}
            />
            <Field
              label="Barrel length (in)"
              name="barrelLengthIn"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder='e.g. 24'
              issues={issuesFor('barrelLengthIn')}
            />
            <Field
              label="Twist rate"
              name="twistRate"
              placeholder='e.g. "1:8"'
              issues={issuesFor('twistRate')}
            />
            <Field
              label="Zero distance (yd)"
              name="zeroDistanceYd"
              type="number"
              step="1"
              min="0"
              inputMode="numeric"
              placeholder="e.g. 100"
              issues={issuesFor('zeroDistanceYd')}
            />
            <Field
              label="Optic notes"
              name="opticNotes"
              placeholder="e.g. NX8 4-32, MIL"
              issues={issuesFor('opticNotes')}
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
            <Button type="submit" disabled={pending} data-testid="rifle-submit">
              {pending ? 'Saving…' : 'Save rifle'}
            </Button>
            <span className="text-[11px] text-text-faint">
              Rifle profile values are recordkeeping only — they do not validate
              loads or imply pressure safety.
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
  testId,
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
  testId?: string;
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
        data-testid={testId}
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
