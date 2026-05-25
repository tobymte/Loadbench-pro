'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  FEEDBACK_STATUSES,
  feedbackStatusLabel,
  feedbackStatusTone,
  feedbackSeverityLabel,
  feedbackTypeLabel,
} from '@/lib/beta/feedback';

type Row = {
  id: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  pageArea: string | null;
  description: string;
  stepsToReproduce: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  deviceBrowser: string | null;
  contactPreference: string | null;
  reporterEmail: string | null;
  reporterDisplay: string | null;
  workspaceId: string | null;
  buildHash: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function BetaFeedbackAdminRow({ row }: { row: Row }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [adminNotes, setAdminNotes] = useState(row.adminNotes ?? '');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = status !== row.status || (adminNotes ?? '') !== (row.adminNotes ?? '');

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/beta-feedback/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (res.ok) {
        setSavedAt(new Date().toLocaleTimeString());
        router.refresh();
      } else {
        const out = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setError(out.message ?? out.error ?? 'Save failed.');
      }
    });
  }

  return (
    <li className="px-5 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex flex-wrap items-start gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text">{row.title}</div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {feedbackTypeLabel(row.type)} · {feedbackSeverityLabel(row.severity)}
            {row.pageArea ? ` · ${row.pageArea}` : ''} ·{' '}
            {row.reporterEmail ?? row.reporterDisplay ?? 'anon'} ·{' '}
            {new Date(row.createdAt).toLocaleString()}
          </div>
        </div>
        <Badge tone={feedbackStatusTone(row.status)}>
          {feedbackStatusLabel(row.status)}
        </Badge>
        <span className="text-[11px] text-text-faint shrink-0">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          <Section title="Description">{row.description}</Section>
          {row.stepsToReproduce && (
            <Section title="Steps to reproduce">{row.stepsToReproduce}</Section>
          )}
          {(row.expectedResult || row.actualResult) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {row.expectedResult && (
                <Section title="Expected">{row.expectedResult}</Section>
              )}
              {row.actualResult && (
                <Section title="Actual">{row.actualResult}</Section>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-text-muted">
            {row.deviceBrowser && (
              <Meta label="Device / browser">{row.deviceBrowser}</Meta>
            )}
            {row.contactPreference && (
              <Meta label="Contact">{row.contactPreference}</Meta>
            )}
            {row.buildHash && (
              <Meta label="Build">{row.buildHash}</Meta>
            )}
            {row.workspaceId && (
              <Meta label="Workspace">{row.workspaceId}</Meta>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="block space-y-1">
              <span className="text-[12px] font-medium text-text">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-9 rounded border border-border bg-bg px-2.5 text-[13px] text-text"
              >
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-[12px] font-medium text-text">
                Admin notes
              </span>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                maxLength={8000}
                className="w-full rounded border border-border bg-bg px-2.5 py-2 text-[13px] text-text"
              />
            </label>
          </div>

          {error && (
            <div className="text-[12px] text-danger border border-danger/40 bg-danger/5 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={pending || !dirty} size="sm">
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
            {savedAt && !dirty && (
              <span className="text-[11px] text-success">Saved {savedAt}</span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">
        {title}
      </div>
      <div className="text-[12px] text-text-muted whitespace-pre-wrap leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-text-faint mr-1">
        {label}:
      </span>
      <span className="text-text">{children}</span>
    </div>
  );
}
