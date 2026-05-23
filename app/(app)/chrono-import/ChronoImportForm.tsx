'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  parseChronoCsv,
  summarizeChrono,
  type ChronoParseResult,
  type ChronoSummary,
} from '@/lib/analysis/chrono';

type Option = { value: string; label: string };

type Issue = { field?: string; code: string; message: string };

const SAMPLE_CSV = `shot,velocityFps,note
1,2735,
2,2742,foul shot
3,2738,
4,2744,
5,2741,`;

export function ChronoImportForm({
  loads,
  rifles,
}: {
  loads: Option[];
  rifles: Option[];
}) {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [loadId, setLoadId] = useState('');
  const [rifleId, setRifleId] = useState('');
  const [location, setLocation] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pending, startTransition] = useTransition();
  const [savedSummary, setSavedSummary] = useState<{
    sessionId: string;
    summary: ChronoSummary;
    invalidRows: number;
  } | null>(null);

  const preview: { parse: ChronoParseResult; summary: ChronoSummary } | null =
    useMemo(() => {
      if (csv.trim().length === 0) return null;
      const parse = parseChronoCsv(csv);
      const summary = summarizeChrono(parse.shots);
      return { parse, summary };
    }, [csv]);

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  function loadSample() {
    setCsv(SAMPLE_CSV);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIssues([]);
    setSavedSummary(null);

    if (!loadId) {
      setIssues([
        {
          field: 'loadId',
          code: 'REQUIRED',
          message: 'Pick a load to import this chronograph session against.',
        },
      ]);
      return;
    }
    if (!preview || preview.parse.shots.length === 0) {
      setIssues([
        {
          field: 'csv',
          code: 'NO_SHOTS',
          message: 'CSV did not contain any parseable velocity rows.',
        },
      ]);
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/chrono-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          csv,
          loadId,
          rifleId: rifleId || null,
          date,
          location: location || null,
          notes: extraNotes || null,
        }),
      });

      if (res.ok) {
        const out = (await res.json()) as {
          sessionId: string;
          summary: ChronoSummary;
          invalidRows: number;
        };
        setSavedSummary(out);
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
          { code: out.error ?? 'UNKNOWN', message: 'Could not import chronograph data.' },
        ]);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      data-testid="chrono-import-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="chrono-load">
            Load<span className="text-accent ml-1">*</span>
          </label>
          <select
            id="chrono-load"
            value={loadId}
            onChange={(e) => setLoadId(e.target.value)}
            data-testid="chrono-load"
            required
          >
            <option value="">— Select a load —</option>
            {loads.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
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
          <label htmlFor="chrono-rifle">Rifle</label>
          <select
            id="chrono-rifle"
            value={rifleId}
            onChange={(e) => setRifleId(e.target.value)}
            data-testid="chrono-rifle"
          >
            <option value="">— None —</option>
            {rifles.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="chrono-date">Date</label>
          <input
            id="chrono-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="chrono-date"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="chrono-location">Location</label>
          <input
            id="chrono-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. home range"
            data-testid="chrono-location"
          />
        </div>
        <div className="md:col-span-1">
          <label htmlFor="chrono-extra-notes">Additional notes</label>
          <input
            id="chrono-extra-notes"
            type="text"
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="optional"
            data-testid="chrono-notes"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="chrono-csv">CSV data</label>
          <button
            type="button"
            className="text-[11px] text-accent hover:text-accent-hover"
            onClick={loadSample}
            data-testid="chrono-load-sample"
          >
            Load sample
          </button>
        </div>
        <textarea
          id="chrono-csv"
          rows={10}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="Paste CSV from your chronograph here"
          className="font-mono text-[12px]"
          data-testid="chrono-csv"
        />
        {issuesFor('csv').map((i) => (
          <p key={i.code} className="text-[11px] text-danger mt-1">
            {i.message}
          </p>
        ))}
      </div>

      {preview && (
        <div
          className="rounded-md border border-border bg-bg-alt/40 p-4 space-y-3"
          data-testid="chrono-preview"
        >
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <PreviewCell label="Shots" value={preview.summary.count.toString()} />
            <PreviewCell
              label="Avg vel"
              value={preview.summary.avgVelocityFps != null ? `${preview.summary.avgVelocityFps} fps` : '—'}
            />
            <PreviewCell
              label="ES"
              value={preview.summary.esFps != null ? `${preview.summary.esFps} fps` : '—'}
            />
            <PreviewCell
              label="SD"
              value={preview.summary.sdFps != null ? `${preview.summary.sdFps} fps` : '—'}
            />
            <PreviewCell
              label="Min"
              value={preview.summary.minFps != null ? `${preview.summary.minFps} fps` : '—'}
            />
            <PreviewCell
              label="Max"
              value={preview.summary.maxFps != null ? `${preview.summary.maxFps} fps` : '—'}
            />
          </div>
          {preview.parse.invalid.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-warning mb-1">
                {preview.parse.invalid.length} invalid row
                {preview.parse.invalid.length === 1 ? '' : 's'} will be skipped
              </div>
              <ul
                className="text-[11px] text-text-muted space-y-0.5"
                data-testid="chrono-invalid-list"
              >
                {preview.parse.invalid.slice(0, 10).map((iv) => (
                  <li key={iv.rowIndex}>
                    <span className="text-text-faint">row {iv.rowIndex}:</span>{' '}
                    {iv.reason}{' '}
                    <span className="text-text-faint">— {iv.raw}</span>
                  </li>
                ))}
                {preview.parse.invalid.length > 10 && (
                  <li className="text-text-faint">
                    + {preview.parse.invalid.length - 10} more…
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {formIssues.map((i) => (
        <div
          key={i.code}
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
        >
          {i.message}
        </div>
      ))}

      {savedSummary && (
        <div
          className="rounded-md border border-success/40 bg-success-subtle px-4 py-3 text-[12px] text-success"
          data-testid="chrono-success"
        >
          Imported {savedSummary.summary.count} shots as a new range session
          (avg {savedSummary.summary.avgVelocityFps} fps, ES{' '}
          {savedSummary.summary.esFps ?? '—'}, SD{' '}
          {savedSummary.summary.sdFps ?? '—'}).{' '}
          {savedSummary.invalidRows > 0 &&
            `${savedSummary.invalidRows} row${
              savedSummary.invalidRows === 1 ? '' : 's'
            } skipped.`}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          disabled={pending || !preview || preview.parse.shots.length === 0}
          data-testid="chrono-submit"
        >
          {pending ? 'Importing…' : 'Import as range session'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Imported observations are records only. No charge or pressure
          validation occurs on import.
        </span>
      </div>
    </form>
  );
}

function PreviewCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-faint">
        {label}
      </div>
      <div className="text-sm font-medium tabular-nums text-text mt-0.5">
        {value}
      </div>
    </div>
  );
}
