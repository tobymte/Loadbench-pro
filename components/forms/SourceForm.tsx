'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

type Issue = { field?: string; code: string; message: string };

export function SourceForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);

    const body = {
      title: ((fd.get('title') as string | null) ?? '').trim(),
      publisher: stringOrNull(fd.get('publisher')),
      edition: stringOrNull(fd.get('edition')),
      publishedYear: intOrNull(fd.get('publishedYear')),
      url: stringOrNull(fd.get('url')),
      citation: stringOrNull(fd.get('citation')),
      publishedMaxGr: numberOrNull(fd.get('publishedMaxGr')),
      notes: stringOrNull(fd.get('notes')),
    };

    startTransition(async () => {
      const res = await fetch('/api/sources', {
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
          { code: out.error ?? 'UNKNOWN', message: 'Could not save source.' },
        ]);
      }
    });
  }

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  return (
    <Card>
      <CardHeader
        title="Add a source"
        description="Record the published reference you cite — manual, manufacturer data, or another printed source. Values you enter here are citations only; LoadBench Pro does not certify load safety."
      />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4" data-testid="source-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Title"
              name="title"
              required
              placeholder="e.g. Hodgdon 2024 Annual Manual"
              issues={issuesFor('title')}
              testId="source-title"
            />
            <Field
              label="Publisher"
              name="publisher"
              placeholder="e.g. Hodgdon"
              issues={issuesFor('publisher')}
            />
            <Field
              label="Edition"
              name="edition"
              placeholder="e.g. 2024"
              issues={issuesFor('edition')}
            />
            <Field
              label="Published year"
              name="publishedYear"
              type="number"
              step="1"
              min="1800"
              inputMode="numeric"
              placeholder="e.g. 2024"
              issues={issuesFor('publishedYear')}
            />
            <Field
              label="URL"
              name="url"
              type="url"
              placeholder="optional link"
              issues={issuesFor('url')}
            />
            <Field
              label="Citation / page"
              name="citation"
              placeholder="e.g. p. 142, table B"
              issues={issuesFor('citation')}
            />
            <Field
              label="Published max charge (gr)"
              name="publishedMaxGr"
              type="number"
              step="0.05"
              min="0"
              inputMode="decimal"
              placeholder="user-entered citation value"
              issues={issuesFor('publishedMaxGr')}
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
            <Button type="submit" disabled={pending} data-testid="source-submit">
              {pending ? 'Saving…' : 'Save source'}
            </Button>
            <span className="text-[11px] text-text-faint">
              Source values are user-entered citations. LoadBench Pro does not
              certify load safety.
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
