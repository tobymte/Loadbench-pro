'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
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

type TemplateKey = 'generic' | 'garmin' | 'labradar' | 'magnetospeed' | 'caldwell';

const TEMPLATES: Record<TemplateKey, { label: string; description: string; csv: string }> = {
  generic: {
    label: 'Generic (shot, velocity, note)',
    description: 'Simple format. First column shot number, second velocity in fps, third note.',
    csv: SAMPLE_CSV,
  },
  garmin: {
    label: 'Garmin Xero C1 / Pro (CSV export)',
    description:
      'Garmin exports include header rows like "Shot #,Speed,Time". The importer recognises both fps and m/s headers — values are auto-converted.',
    csv: `Shot #,Speed (fps),Time
1,2735,12:00:01
2,2742,12:00:42
3,2738,12:01:18
4,2744,12:01:55
5,2741,12:02:28`,
  },
  labradar: {
    label: 'LabRadar (Trk### CSV)',
    description:
      'LabRadar saves per-track CSVs. The importer skips comment lines and reads the "V0" column when present.',
    csv: `# Device: LabRadar
# Series: 01 - Range A
Shot,V0 (fps),Note
1,2735,
2,2742,foul shot
3,2738,
4,2744,
5,2741,`,
  },
  magnetospeed: {
    label: 'MagnetoSpeed (V3 / Sporter)',
    description:
      'MagnetoSpeed exports list shot index and velocity. Tabs and semicolons are auto-detected.',
    csv: `Series\tShot\tVelocity (fps)
1\t1\t2735
1\t2\t2742
1\t3\t2738
1\t4\t2744
1\t5\t2741`,
  },
  caldwell: {
    label: 'Caldwell Ballistic Precision',
    description:
      'Caldwell exports use comma-separated "Shot,Velocity (FPS),Notes" with a header row.',
    csv: `Shot,Velocity (FPS),Notes
1,2735,
2,2742,foul shot
3,2738,
4,2744,
5,2741,`,
  },
};

export function ChronoImportForm({
  loads,
  rifles,
  saveAvailable = true,
}: {
  loads: Option[];
  rifles: Option[];
  saveAvailable?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
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

  function applyTemplate(key: TemplateKey) {
    setCsv(TEMPLATES[key].csv);
    setFileName(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setIssues([
        {
          code: 'FILE_TOO_LARGE',
          message:
            'File is larger than 2 MB — chronograph exports should be small text files. Open it in a text editor and paste the relevant portion instead.',
        },
      ]);
      return;
    }
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIssues([]);
    setSavedSummary(null);

    if (!saveAvailable) {
      setIssues([
        {
          code: 'NO_DATABASE',
          message:
            'Saving is disabled because no database is configured. Preview-only mode.',
        },
      ]);
      return;
    }

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
        message?: string;
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
            message: out.message ?? 'Could not import chronograph data.',
          },
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
            required={saveAvailable}
            disabled={!saveAvailable}
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
            disabled={!saveAvailable}
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

      <div className="rounded-md border border-border bg-bg-alt/30 p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          Quick start templates
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
            <button
              key={k}
              type="button"
              className="text-[11px] border border-border rounded px-2 py-1 hover:bg-bg-alt"
              onClick={() => applyTemplate(k)}
              data-testid={`chrono-template-${k}`}
              title={TEMPLATES[k].description}
            >
              {TEMPLATES[k].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-faint">
          Templates load a small sample so you can confirm the importer reads
          your chrono&apos;s format. m/s values are auto-converted; tabs and
          semicolons are auto-detected.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <label htmlFor="chrono-csv">CSV data</label>
          <div className="flex items-center gap-3">
            <label
              htmlFor="chrono-file"
              className="text-[11px] text-accent hover:text-accent-hover cursor-pointer"
              data-testid="chrono-file-label"
            >
              Choose file (parsed locally)
            </label>
            <input
              id="chrono-file"
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              onChange={onFile}
              className="hidden"
              data-testid="chrono-file"
            />
            <button
              type="button"
              className="text-[11px] text-accent hover:text-accent-hover"
              onClick={() => applyTemplate('generic')}
              data-testid="chrono-load-sample"
            >
              Load sample
            </button>
            {csv && (
              <button
                type="button"
                className="text-[11px] text-text-muted hover:text-text"
                onClick={() => {
                  setCsv('');
                  setFileName(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                data-testid="chrono-clear"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {fileName && (
          <p className="text-[11px] text-text-muted mb-1" data-testid="chrono-file-name">
            Loaded <code>{fileName}</code> (parsed in browser — not uploaded
            until you press Import).
          </p>
        )}
        <textarea
          id="chrono-csv"
          rows={10}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setFileName(null);
          }}
          placeholder="Paste CSV from your chronograph here, or choose a file above"
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
          <div className="text-[11px] text-text-faint">
            Detected unit: <code>{preview.parse.detectedUnit}</code>
            {preview.parse.headerDetected ? ' · header row detected' : ' · no header detected'}
          </div>
          {preview.parse.warnings.length > 0 && (
            <ul className="space-y-1" data-testid="chrono-warnings">
              {preview.parse.warnings.map((w, idx) => (
                <li
                  key={idx}
                  className="text-[11px] text-warning border border-warning/30 bg-warning-subtle px-2 py-1 rounded"
                >
                  {w.message}
                </li>
              ))}
            </ul>
          )}
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
          disabled={
            pending ||
            !saveAvailable ||
            !preview ||
            preview.parse.shots.length === 0
          }
          data-testid="chrono-submit"
        >
          {pending
            ? 'Importing…'
            : saveAvailable
              ? 'Import as range session'
              : 'Save disabled — preview only'}
        </Button>
        <span className="text-[11px] text-text-faint">
          {saveAvailable
            ? 'Imported observations are records only. No charge or pressure validation occurs on import.'
            : 'Preview-only mode: parse and summarize CSV locally. Configure DATABASE_URL to save sessions.'}
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
