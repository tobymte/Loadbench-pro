'use client';

// Assisted CIP Source Import — interactive form (client component).
//
// SAFETY: This component only handles SOURCE METADATA. It never displays,
// requests, or computes chamber pressure, charge recommendations, or
// safe/unsafe verdicts. The numeric reference fields (Pmax, volumes,
// rifling) are NOT collected here — they are transcribed manually on the
// main admin page (/admin/shooters-world-cip) after the draft is created.

import { useState } from 'react';
import { CIP_KNOWN_HOSTS } from '@/lib/validation/cipSourceFetch';

type PreviewMeta = {
  ok: boolean;
  url: string;
  host: string | null;
  isKnownCipHost: boolean;
  status: number | null;
  contentType: string | null;
  contentLength: number | null;
  lastModified: string | null;
  pdfFilename: string | null;
  htmlTitle: string | null;
  warnings: string[];
  fetchedAt: string;
  errorMessage: string | null;
};

export function AssistedImportForm() {
  const [sourceUrl, setSourceUrl] = useState('');
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function runPreview() {
    setPreviewing(true);
    setPreviewError(null);
    setMeta(null);
    try {
      const res = await fetch('/api/admin/cip-reference/source-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const json = (await res.json()) as { meta?: PreviewMeta; message?: string };
      if (!res.ok) {
        setPreviewError(json.message ?? `HTTP ${res.status}`);
        return;
      }
      setMeta(json.meta ?? null);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Preview failed.');
    } finally {
      setPreviewing(false);
    }
  }

  const hostUnknown = meta != null && !meta.isKnownCipHost;

  return (
    <div className="space-y-4" data-testid="cip-import-form">
      <div className="rounded-md border border-border bg-bg-alt p-4 space-y-3">
        <label className="flex flex-col gap-1 text-[12px] text-text-muted">
          <span>CIP source URL *</span>
          <input
            type="url"
            required
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://cip-bobp.org/tdcc/<cartridge>.pdf"
            className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
            data-testid="cip-import-url"
          />
          <span className="text-[11px] text-text-faint">
            Allow-list: {CIP_KNOWN_HOSTS.join(', ')}. Other hosts require an
            explicit acknowledgement below.
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={previewing || !sourceUrl.trim()}
            className="h-8 px-3 rounded bg-bg border border-border text-[12px] text-text hover:bg-bg-alt disabled:opacity-50"
            data-testid="cip-import-preview-btn"
          >
            {previewing ? 'Fetching…' : 'Fetch source metadata'}
          </button>
          <span className="text-[11px] text-text-faint">
            Server-side fetch · metadata only · no PDF parsing
          </span>
        </div>
        {previewError && (
          <p
            className="text-[12px] text-danger"
            data-testid="cip-import-preview-error"
          >
            {previewError}
          </p>
        )}
      </div>

      {meta && (
        <div
          className="rounded-md border border-border bg-bg-alt p-4 space-y-2"
          data-testid="cip-import-preview"
        >
          <h3 className="text-[13px] font-semibold text-text">
            Detected metadata
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            <dt className="text-text-faint">URL</dt>
            <dd className="text-text break-all">{meta.url}</dd>
            <dt className="text-text-faint">Host</dt>
            <dd className="text-text">
              {meta.host ?? '—'}{' '}
              {meta.isKnownCipHost ? (
                <span className="text-success">(known CIP host)</span>
              ) : (
                <span className="text-warning">(non-CIP host)</span>
              )}
            </dd>
            <dt className="text-text-faint">HTTP status</dt>
            <dd className="text-text">{meta.status ?? '—'}</dd>
            <dt className="text-text-faint">Content type</dt>
            <dd className="text-text">{meta.contentType ?? '—'}</dd>
            <dt className="text-text-faint">Content length</dt>
            <dd className="text-text">{meta.contentLength ?? '—'}</dd>
            <dt className="text-text-faint">Last modified</dt>
            <dd className="text-text">{meta.lastModified ?? '—'}</dd>
            <dt className="text-text-faint">HTML title</dt>
            <dd className="text-text">{meta.htmlTitle ?? '—'}</dd>
            <dt className="text-text-faint">PDF filename</dt>
            <dd className="text-text">{meta.pdfFilename ?? '—'}</dd>
            <dt className="text-text-faint">Fetched at</dt>
            <dd className="text-text">{meta.fetchedAt}</dd>
          </dl>
          {meta.errorMessage && (
            <p className="text-[12px] text-danger">
              Fetch error: {meta.errorMessage}. You can still create a draft
              from the URL manually.
            </p>
          )}
          {meta.warnings.length > 0 && (
            <ul className="text-[12px] text-warning list-disc pl-5">
              {meta.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-text-faint">
            Reminder: no Pmax / volume / rifling values are derived from this
            response. Transcribe them on the admin page after the draft is
            created.
          </p>
        </div>
      )}

      <form
        method="post"
        action="/api/admin/cip-reference/source-import"
        className="space-y-3"
        data-testid="cip-import-submit-form"
      >
        <input type="hidden" name="sourceUrl" value={sourceUrl} />
        <input
          type="hidden"
          name="sourceLabel"
          value={meta?.htmlTitle ?? meta?.pdfFilename ?? ''}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            <span>Cartridge name *</span>
            <input
              type="text"
              name="cartridgeName"
              required
              className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              data-testid="cip-import-cartridge"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            <span>Caliber label</span>
            <input
              type="text"
              name="cartridgeCaliberLabel"
              placeholder="e.g. 6.5x48"
              className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            <span>Powder manufacturer</span>
            <input
              type="text"
              name="powderManufacturer"
              className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            <span>Powder family</span>
            <input
              type="text"
              name="powderFamily"
              className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            <span>Powder name</span>
            <input
              type="text"
              name="powderName"
              className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            <span>Source revision</span>
            <input
              type="text"
              name="sourceRevision"
              className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[12px] text-text-muted">
          <span>Notes</span>
          <textarea
            name="notes"
            rows={2}
            className="px-2 py-1 rounded border border-border bg-bg text-[13px] text-text"
          />
        </label>
        {hostUnknown && (
          <label className="flex items-center gap-2 text-[12px] text-warning">
            <input
              type="checkbox"
              name="acknowledgedNonCipHost"
              data-testid="cip-import-ack-non-cip"
            />
            <span>
              I trust this non-CIP source and accept that the draft is still
              unverified until I compare it against the official CIP record.
            </span>
          </label>
        )}
        <label className="flex items-center gap-2 text-[12px] text-text-muted">
          <input
            type="checkbox"
            name="fetchPreview"
            defaultChecked
            value="on"
          />
          <span>
            Re-fetch source metadata server-side on submit (recommended; turn
            off if the host is unreachable from the server).
          </span>
        </label>
        <div className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-[12px] text-text">
          New rows are saved as <strong>DRAFT</strong>. Pmax, reference
          volumes, and rifling F·Z·G are <em>not</em> auto-filled and must be
          transcribed manually. Pressure prediction stays disabled.
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="h-8 px-3 rounded bg-accent text-bg text-[12px] font-medium hover:bg-accent-hover"
            data-testid="cip-import-submit"
          >
            Create draft from URL
          </button>
        </div>
      </form>
    </div>
  );
}
