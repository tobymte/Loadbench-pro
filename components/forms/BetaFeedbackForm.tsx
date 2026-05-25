'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import {
  FEEDBACK_TYPES,
  FEEDBACK_SEVERITIES,
} from '@/lib/beta/feedback';

type Issue = { field?: string; message: string };

export function BetaFeedbackForm({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deviceBrowser, setDeviceBrowser] = useState('');

  // Best-effort device/browser autofill so testers don't have to type it.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      setDeviceBrowser(navigator.userAgent.slice(0, 240));
    }
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    setSubmitError(null);
    const form = event.currentTarget;
    const fd = new FormData(form);

    const body = {
      title: (fd.get('title') as string | null)?.trim() ?? '',
      type: (fd.get('type') as string | null) ?? 'BUG',
      severity: (fd.get('severity') as string | null) ?? 'MEDIUM',
      pageArea: ((fd.get('pageArea') as string | null) ?? '').trim() || null,
      description:
        ((fd.get('description') as string | null) ?? '').trim() || '',
      stepsToReproduce:
        ((fd.get('stepsToReproduce') as string | null) ?? '').trim() || null,
      expectedResult:
        ((fd.get('expectedResult') as string | null) ?? '').trim() || null,
      actualResult:
        ((fd.get('actualResult') as string | null) ?? '').trim() || null,
      deviceBrowser:
        ((fd.get('deviceBrowser') as string | null) ?? '').trim() || null,
      contactPreference:
        ((fd.get('contactPreference') as string | null) ?? '').trim() || null,
      reporterEmail:
        ((fd.get('reporterEmail') as string | null) ?? '').trim() || null,
      buildHash:
        ((fd.get('buildHash') as string | null) ?? '').trim() || null,
    };

    startTransition(async () => {
      const res = await fetch('/api/beta-feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        setSubmittedId(json.id ?? 'submitted');
        form.reset();
        router.refresh();
        return;
      }

      const out = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        issues?: Array<{
          path?: Array<string | number>;
          message?: string;
        }>;
      };
      if (out.issues && Array.isArray(out.issues)) {
        setIssues(
          out.issues.map((i) => ({
            field: i.path?.[0] !== undefined ? String(i.path[0]) : undefined,
            message: i.message ?? 'Invalid value',
          })),
        );
      } else {
        setSubmitError(
          out.message ?? out.error ?? 'Submission failed. Please try again.',
        );
      }
    });
  }

  if (submittedId) {
    return (
      <Card>
        <CardHeader
          title="Feedback received — thank you"
          description="An operator will triage this on the admin issue tracker."
        />
        <CardBody className="space-y-3">
          <p className="text-[12px] text-text-muted leading-relaxed">
            Your report has been recorded with id <code className="text-accent">{submittedId}</code>.
            {authenticated
              ? ' You can see all of your recent submissions on this page once the workspace lookup completes.'
              : ' Without a workspace association the report was filed under the dev-fallback bucket; an admin will still see it.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSubmittedId(null)} variant="secondary">
              File another report
            </Button>
            <Link href="/beta">
              <Button variant="ghost">Back to beta package</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  const fieldError = (field: string) =>
    issues.find((i) => i.field === field)?.message;

  return (
    <Card>
      <CardHeader
        title="Submit beta feedback"
        description="Bug reports, usability feedback, feature requests, data and safety concerns, performance and mobile issues, deployment/login problems."
      />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Title"
            hint="One short sentence. e.g. “Save button hidden on /loads on iPhone SE”."
            error={fieldError('title')}
            required
          >
            <input
              name="title"
              required
              maxLength={240}
              minLength={3}
              className={inputCls}
              placeholder="One-sentence summary"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Type" error={fieldError('type')} required>
              <select name="type" defaultValue="BUG" className={inputCls}>
                {FEEDBACK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severity" error={fieldError('severity')} required>
              <select
                name="severity"
                defaultValue="MEDIUM"
                className={inputCls}
              >
                {FEEDBACK_SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Page / area" error={fieldError('pageArea')}>
              <input
                name="pageArea"
                maxLength={120}
                className={inputCls}
                placeholder="/loads, mobile nav, /chrono-import…"
              />
            </Field>
          </div>

          <Field
            label="Description"
            hint="What did you see? What went wrong? Include screenshots links if you have them."
            error={fieldError('description')}
            required
          >
            <textarea
              name="description"
              required
              rows={5}
              minLength={5}
              maxLength={8000}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Steps to reproduce"
              hint="1. … 2. … 3. …"
              error={fieldError('stepsToReproduce')}
            >
              <textarea
                name="stepsToReproduce"
                rows={4}
                maxLength={8000}
                className={inputCls}
              />
            </Field>
            <div className="space-y-3">
              <Field label="Expected result" error={fieldError('expectedResult')}>
                <textarea
                  name="expectedResult"
                  rows={2}
                  maxLength={2000}
                  className={inputCls}
                />
              </Field>
              <Field label="Actual result" error={fieldError('actualResult')}>
                <textarea
                  name="actualResult"
                  rows={2}
                  maxLength={2000}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Device / browser"
              hint="Auto-filled from your browser; edit if needed."
              error={fieldError('deviceBrowser')}
            >
              <input
                name="deviceBrowser"
                defaultValue={deviceBrowser}
                maxLength={240}
                className={inputCls}
              />
            </Field>
            <Field
              label="Build / commit hash"
              hint="Optional. From the app footer, if shown."
              error={fieldError('buildHash')}
            >
              <input
                name="buildHash"
                maxLength={64}
                className={inputCls}
                placeholder="e.g. 30435c5"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Contact preference"
              hint='Optional. "email me back", "discord: handle", "no reply needed", …'
              error={fieldError('contactPreference')}
            >
              <input
                name="contactPreference"
                maxLength={240}
                className={inputCls}
              />
            </Field>
            {!authenticated && (
              <Field
                label="Your email"
                hint="Only used to follow up on this report."
                error={fieldError('reporterEmail')}
              >
                <input
                  name="reporterEmail"
                  type="email"
                  maxLength={240}
                  className={inputCls}
                />
              </Field>
            )}
          </div>

          {submitError && (
            <div className="text-[12px] text-danger leading-relaxed border border-danger/40 bg-danger/5 rounded p-3">
              {submitError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Submit feedback'}
            </Button>
            <Link href="/beta">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>

          <p className="text-[11px] text-text-faint leading-relaxed">
            Reminder: LoadBench Pro does not predict pressure, recommend
            charges, or rate loads safe or unsafe. Safety concerns flagged
            here are recorded as user reports for human triage — they are not
            processed into advice.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}

const inputCls =
  'w-full h-9 rounded border border-border bg-bg px-2.5 text-[13px] text-text placeholder:text-text-faint focus:outline-none focus:border-accent';

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-medium text-text">{label}</span>
        {required && <span className="text-[10px] text-danger">required</span>}
      </div>
      {/* Textareas inherit only the border/bg via .resize fix; we override min-height by reapplying class */}
      <div className="[&_textarea]:min-h-[3rem] [&_textarea]:h-auto [&_textarea]:py-2">
        {children}
      </div>
      {hint && !error && (
        <p className="text-[11px] text-text-muted">{hint}</p>
      )}
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </label>
  );
}
