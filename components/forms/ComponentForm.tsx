'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

type Issue = { field?: string; code: string; message: string };
type Kind = 'BULLET' | 'POWDER' | 'PRIMER' | 'CASE';

const KIND_OPTIONS: Array<{ value: Kind; label: string }> = [
  { value: 'BULLET', label: 'Bullet' },
  { value: 'POWDER', label: 'Powder' },
  { value: 'PRIMER', label: 'Primer' },
  { value: 'CASE', label: 'Case' },
];

const KIND_HINTS: Record<Kind, string> = {
  BULLET: 'Useful: bullet weight (gr) and ballistic coefficient (BC).',
  POWDER: 'Useful: burn-rate label (e.g. "H4350") and lot number.',
  PRIMER: 'Useful: lot number and any notes (e.g. magnum, benchrest).',
  CASE: 'Useful: lot number, headstamp details in notes.',
};

export function ComponentForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [kind, setKind] = useState<Kind>('BULLET');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);

    const body = {
      kind: (fd.get('kind') as string | null) ?? '',
      manufacturer: ((fd.get('manufacturer') as string | null) ?? '').trim(),
      model: ((fd.get('model') as string | null) ?? '').trim(),
      bulletWeightGr: numberOrNull(fd.get('bulletWeightGr')),
      bulletBc: numberOrNull(fd.get('bulletBc')),
      burnRateLabel: stringOrNull(fd.get('burnRateLabel')),
      lotNumber: stringOrNull(fd.get('lotNumber')),
      quantityOnHand: numberOrNullAllowZero(fd.get('quantityOnHand')),
      unit: stringOrNull(fd.get('unit')),
      lowStockThreshold: numberOrNullAllowZero(fd.get('lowStockThreshold')),
      notes: stringOrNull(fd.get('notes')),
      archived: fd.get('archived') === 'on',
    };

    const numericIssues: Issue[] = [];
    for (const key of ['bulletWeightGr', 'bulletBc'] as const) {
      const raw = fd.get(key);
      if (raw && raw.toString().trim() !== '' && body[key] === null) {
        numericIssues.push({
          field: key,
          code: 'INVALID_NUMBER',
          message: 'Enter a valid positive number.',
        });
      }
    }
    if (numericIssues.length > 0) {
      setIssues(numericIssues);
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/components', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        form.reset();
        setKind('BULLET');
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
          { code: out.error ?? 'UNKNOWN', message: 'Could not save component.' },
        ]);
      }
    });
  }

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  return (
    <Card>
      <CardHeader
        title="Add a component"
        description="Record the bullets, powders, primers, and cases you have on hand. LoadBench Pro does not recommend substitutions or load data — values you enter are inventory only."
      />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="kind">
                Kind<span className="text-accent ml-1">*</span>
              </label>
              <select
                id="kind"
                name="kind"
                required
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {issuesFor('kind').map((i) => (
                <p key={i.code} className="text-[11px] text-danger mt-1">
                  {i.message}
                </p>
              ))}
              <p className="text-[11px] text-text-faint mt-1">
                {KIND_HINTS[kind]}
              </p>
            </div>
            <Field
              label="Manufacturer"
              name="manufacturer"
              required
              placeholder="e.g. Hornady"
              issues={issuesFor('manufacturer')}
            />
            <Field
              label="Model"
              name="model"
              required
              placeholder="e.g. ELD-M 140gr"
              issues={issuesFor('model')}
            />
            <Field
              label="Lot number"
              name="lotNumber"
              placeholder="optional"
              issues={issuesFor('lotNumber')}
            />
            <Field
              label="Bullet weight (gr)"
              name="bulletWeightGr"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              placeholder={kind === 'BULLET' ? 'e.g. 140' : 'bullet only'}
              issues={issuesFor('bulletWeightGr')}
            />
            <Field
              label="Bullet BC"
              name="bulletBc"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              placeholder={kind === 'BULLET' ? 'e.g. 0.610' : 'bullet only'}
              issues={issuesFor('bulletBc')}
            />
            <Field
              label="Burn-rate label"
              name="burnRateLabel"
              placeholder={kind === 'POWDER' ? 'e.g. H4350' : 'powder only'}
              issues={issuesFor('burnRateLabel')}
            />
            <Field
              label="Quantity on hand"
              name="quantityOnHand"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="optional"
              issues={issuesFor('quantityOnHand')}
            />
            <Field
              label="Unit"
              name="unit"
              placeholder={kind === 'POWDER' ? 'lb or gr' : 'ct'}
              issues={issuesFor('unit')}
            />
            <Field
              label="Low-stock threshold"
              name="lowStockThreshold"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="optional"
              issues={issuesFor('lowStockThreshold')}
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

          <div className="flex items-center gap-2">
            <input id="archived" name="archived" type="checkbox" />
            <label htmlFor="archived" className="text-[12px]">
              Archived (hide from default views)
            </label>
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
              {pending ? 'Saving…' : 'Save component'}
            </Button>
            <span className="text-[11px] text-text-faint">
              Inventory only — LoadBench Pro does not recommend substitutions or
              load data.
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
  return Number.isFinite(n) && n > 0 ? n : null;
}

function numberOrNullAllowZero(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = v.toString().trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
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
