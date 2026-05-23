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

export function PressureModelVersionForm() {
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
      description: stringOrNull(fd.get('description')),
      status: ((fd.get('status') as string | null) ?? 'DRAFT'),
      notes: stringOrNull(fd.get('notes')),
    };

    startTransition(async () => {
      const res = await fetch('/api/pressure-modeling/versions', {
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
            message: 'Could not save model version.',
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
      data-testid="pressure-model-version-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name">
            Name <span className="text-accent ml-1">*</span>
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. 6.5CM-H4350-baseline-v0"
            data-testid="pressure-model-version-name"
          />
          {issuesFor('name').map((i) => (
            <p key={i.code} className="text-[11px] text-danger mt-1">
              {i.message}
            </p>
          ))}
        </div>
        <div>
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            defaultValue="DRAFT"
            data-testid="pressure-model-version-status"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          placeholder="What does this candidate model identity describe? It is documentation, not an executable."
        />
      </div>
      <div>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Reviewer comments, blockers, next steps."
        />
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
          data-testid="pressure-model-version-submit"
        >
          {pending ? 'Saving…' : 'Save model version'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Model versions are documentation. No solver runs from this row.
        </span>
      </div>
    </form>
  );
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = v.toString().trim();
  return s === '' ? null : s;
}
