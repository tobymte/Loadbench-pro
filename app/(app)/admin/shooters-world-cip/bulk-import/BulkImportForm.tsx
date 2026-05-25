'use client';

// Bulk CSV Import — interactive client component.
//
// SAFETY: This component handles METADATA only. It never displays, requests,
// or computes chamber pressure, charge recommendations, or safe/unsafe
// verdicts. Imported rows always land as DRAFT — verification is a separate,
// per-row admin action on the main /admin/shooters-world-cip page.

import { useState, useRef } from 'react';
import { CIP_TEMPLATE_CSV_HEADERS } from '@/lib/validation/cipReference';

type ParsedRow = {
  rowNumber: number;
  raw: string;
  values: Record<string, unknown>;
  errors: { field?: string; message: string }[];
  warnings: { field?: string; message: string }[];
};

type PreviewResponse = {
  ok: boolean;
  mode?: 'preview' | 'commit';
  headerDetected?: boolean;
  rowCount?: number;
  totalErrors?: number;
  totalWarnings?: number;
  rows?: ParsedRow[];
  error?: string;
};

type CommitResponse = {
  ok: boolean;
  mode?: 'commit';
  createdCount?: number;
  failedCount?: number;
  created?: { rowNumber: number; id: string; cartridgeName: string }[];
  failed?: { rowNumber: number; message: string }[];
  totalWarnings?: number;
  note?: string;
  error?: string;
};

const FIELD_DISPLAY: Record<string, string> = {
  cartridgeName: 'Cartridge',
  cartridgeCaliberLabel: 'Caliber',
  powderManufacturer: 'Mfr',
  powderFamily: 'Family',
  powderName: 'Powder',
  sourceUrl: 'Source URL',
  sourceLabel: 'Source label',
  sourceRevision: 'Rev',
  sourceDate: 'Source date',
  pmaxValue: 'Pmax',
  pmaxUnit: 'Pmax unit',
  referenceChamberVolume: 'Vchamber',
  referenceCombustionVolume: 'Vcomb',
  volumeUnit: 'Vol unit',
  riflingF: 'F',
  riflingZ: 'Z',
  riflingG: 'G',
  notes: 'Notes',
};

export function BulkImportForm() {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commit, setCommit] = useState<CommitResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1_000_000) {
      setTopError(
        `File too large (${f.size} bytes). Limit 1,000,000 bytes (1 MB). Split into smaller batches.`,
      );
      return;
    }
    const text = await f.text();
    setCsvText(text);
    setPreview(null);
    setCommit(null);
    setTopError(null);
  }

  async function runPreview() {
    setBusy(true);
    setTopError(null);
    setPreview(null);
    setCommit(null);
    try {
      const res = await fetch('/api/admin/cip-reference/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, mode: 'preview' }),
      });
      const json = (await res.json()) as PreviewResponse;
      if (!res.ok || !json.ok) {
        setTopError(json.error ?? `HTTP ${res.status}`);
        setPreview(json);
        return;
      }
      setPreview(json);
    } catch (e) {
      setTopError(e instanceof Error ? e.message : 'Preview failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    if (!ack) {
      setTopError(
        'Tick the acknowledgement before importing. Imported rows will land as DRAFT.',
      );
      return;
    }
    setBusy(true);
    setTopError(null);
    setCommit(null);
    try {
      const res = await fetch('/api/admin/cip-reference/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: csvText,
          mode: 'commit',
          acknowledgedDraftOnly: true,
        }),
      });
      const json = (await res.json()) as CommitResponse;
      setCommit(json);
      if (!res.ok || !json.ok) {
        setTopError(
          json.error ??
            (json.failedCount
              ? `${json.failedCount} row(s) failed to save.`
              : `HTTP ${res.status}`),
        );
      }
    } catch (e) {
      setTopError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function copyTemplate() {
    const headerLine = CIP_TEMPLATE_CSV_HEADERS.join(',');
    void navigator.clipboard.writeText(headerLine + '\n');
  }

  const previewRows = preview?.rows ?? [];
  const errorRows = previewRows.filter((r) => r.errors.length > 0);
  const okPreview = preview?.ok && previewRows.length > 0;
  const canCommit = okPreview && (preview?.totalErrors ?? 0) === 0;

  return (
    <div className="space-y-4" data-testid="cip-bulk-import-form">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/api/admin/cip-reference/template"
          className="h-8 inline-flex items-center px-3 rounded border border-border bg-bg-alt text-[12px] text-text hover:text-accent"
          data-testid="cip-bulk-template-download"
        >
          Download template CSV
        </a>
        <button
          type="button"
          onClick={copyTemplate}
          className="h-8 inline-flex items-center px-3 rounded border border-border bg-bg-alt text-[12px] text-text hover:text-accent"
        >
          Copy headers only
        </button>
        <label className="h-8 inline-flex items-center px-3 rounded border border-border bg-bg-alt text-[12px] text-text hover:text-accent cursor-pointer">
          <span>Upload CSV file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={handleFileSelected}
            data-testid="cip-bulk-file-input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[12px] text-text-muted">
        <span>Paste CSV (or it appears here after upload)</span>
        <textarea
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setPreview(null);
            setCommit(null);
          }}
          rows={10}
          spellCheck={false}
          placeholder={`${CIP_TEMPLATE_CSV_HEADERS.join(',')}\n6.5 Creedmoor,6.5x48,Shooters World,...`}
          className="px-2 py-1 rounded border border-border bg-bg font-mono text-[12px] text-text"
          data-testid="cip-bulk-csv-textarea"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runPreview}
          disabled={busy || !csvText.trim()}
          className="h-8 px-3 rounded bg-accent text-bg text-[12px] font-medium hover:bg-accent-hover disabled:opacity-50"
          data-testid="cip-bulk-preview-button"
        >
          {busy ? 'Working…' : 'Validate & preview'}
        </button>
      </div>

      {topError && (
        <div
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-3 text-[13px] text-text"
          data-testid="cip-bulk-error"
        >
          {topError}
        </div>
      )}

      {preview && (
        <div
          className="rounded-md border border-border bg-bg-alt px-4 py-3 text-[13px] text-text space-y-3"
          data-testid="cip-bulk-preview"
        >
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-text-muted">
            <span>Header detected: {String(preview.headerDetected ?? false)}</span>
            <span>Rows: {preview.rowCount ?? 0}</span>
            <span>
              Errors:{' '}
              <strong className={(preview.totalErrors ?? 0) > 0 ? 'text-danger' : ''}>
                {preview.totalErrors ?? 0}
              </strong>
            </span>
            <span>
              Warnings:{' '}
              <strong className={(preview.totalWarnings ?? 0) > 0 ? 'text-warning' : ''}>
                {preview.totalWarnings ?? 0}
              </strong>
            </span>
          </div>

          {previewRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-left text-text-faint">
                  <tr>
                    <th className="py-1 pr-3 font-medium">#</th>
                    <th className="py-1 pr-3 font-medium">State</th>
                    <th className="py-1 pr-3 font-medium">Cartridge</th>
                    <th className="py-1 pr-3 font-medium">Powder</th>
                    <th className="py-1 pr-3 font-medium">Pmax</th>
                    <th className="py-1 pr-3 font-medium">Source</th>
                    <th className="py-1 pr-3 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => {
                    const v = r.values as Record<string, unknown>;
                    const hasErrors = r.errors.length > 0;
                    const hasWarnings = r.warnings.length > 0;
                    const state = hasErrors ? 'error' : hasWarnings ? 'warn' : 'ok';
                    return (
                      <tr
                        key={r.rowNumber}
                        className="border-t border-border align-top"
                        data-testid={`cip-bulk-preview-row-${r.rowNumber}`}
                      >
                        <td className="py-1.5 pr-3 tabular-nums text-text-muted">
                          {r.rowNumber}
                        </td>
                        <td className="py-1.5 pr-3">
                          {state === 'error' && (
                            <span className="text-danger">error</span>
                          )}
                          {state === 'warn' && (
                            <span className="text-warning">warn</span>
                          )}
                          {state === 'ok' && (
                            <span className="text-success">ok</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3">
                          <div className="font-medium">
                            {String(v.cartridgeName ?? '—')}
                          </div>
                          {v.cartridgeCaliberLabel ? (
                            <div className="text-text-faint text-[11px]">
                              {String(v.cartridgeCaliberLabel)}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-1.5 pr-3">
                          {v.powderManufacturer ? (
                            <div className="text-text-muted">
                              {String(v.powderManufacturer)}
                            </div>
                          ) : null}
                          {v.powderName ? (
                            <div>{String(v.powderName)}</div>
                          ) : (
                            <span className="text-text-faint">—</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {v.pmaxValue != null
                            ? `${String(v.pmaxValue)} ${String(v.pmaxUnit ?? '')}`
                            : '—'}
                        </td>
                        <td className="py-1.5 pr-3 break-all">
                          {v.sourceUrl ? (
                            <span className="text-accent">{String(v.sourceUrl)}</span>
                          ) : (
                            <span className="text-text-faint">—</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-[11px]">
                          {r.errors.map((e, i) => (
                            <div
                              key={`e${i}`}
                              className="text-danger"
                              data-testid={`cip-bulk-row-${r.rowNumber}-error`}
                            >
                              {e.field ? `${FIELD_DISPLAY[e.field] ?? e.field}: ` : ''}
                              {e.message}
                            </div>
                          ))}
                          {r.warnings.map((w, i) => (
                            <div
                              key={`w${i}`}
                              className="text-warning"
                              data-testid={`cip-bulk-row-${r.rowNumber}-warning`}
                            >
                              {w.field ? `${FIELD_DISPLAY[w.field] ?? w.field}: ` : ''}
                              {w.message}
                            </div>
                          ))}
                          {r.errors.length === 0 && r.warnings.length === 0 && (
                            <span className="text-text-faint">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {okPreview && (
            <div className="border-t border-border pt-3 space-y-2">
              {!canCommit && (
                <p className="text-[12px] text-danger" data-testid="cip-bulk-block-message">
                  Fix the {errorRows.length} row(s) with errors above before importing.
                </p>
              )}
              <label className="flex items-start gap-2 text-[12px] text-text-muted">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  data-testid="cip-bulk-ack"
                />
                <span>
                  I acknowledge that imported rows will be saved as{' '}
                  <strong>DRAFT</strong> only — never auto-verified — and that I
                  will compare each row against its cited source before promoting
                  it to <strong>VERIFIED</strong>. This import contains
                  reference metadata only; it does not compute chamber pressure
                  or recommend charges.
                </span>
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={runCommit}
                  disabled={!canCommit || !ack || busy}
                  className="h-8 px-3 rounded bg-accent text-bg text-[12px] font-medium hover:bg-accent-hover disabled:opacity-50"
                  data-testid="cip-bulk-commit-button"
                >
                  {busy ? 'Importing…' : `Import ${previewRows.length} row(s) as DRAFT`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {commit && (
        <div
          className={`rounded-md border px-4 py-3 text-[13px] space-y-2 ${
            commit.ok
              ? 'border-success/40 bg-success-subtle'
              : 'border-warning/40 bg-warning-subtle'
          }`}
          data-testid="cip-bulk-commit-result"
        >
          <div>
            <strong>Imported {commit.createdCount ?? 0} draft row(s)</strong>
            {(commit.failedCount ?? 0) > 0 && (
              <span className="text-danger">
                {' '}
                · {commit.failedCount} failed
              </span>
            )}
            .
          </div>
          {commit.note && (
            <p className="text-[12px] text-text-muted">{commit.note}</p>
          )}
          {commit.created && commit.created.length > 0 && (
            <details className="text-[12px] text-text-muted">
              <summary>Created rows ({commit.created.length})</summary>
              <ul className="list-disc pl-5 mt-1">
                {commit.created.map((c) => (
                  <li key={c.id}>
                    Row {c.rowNumber}: {c.cartridgeName} ·{' '}
                    <code className="text-accent">{c.id}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {commit.failed && commit.failed.length > 0 && (
            <details className="text-[12px] text-text" open>
              <summary className="text-danger">
                Failed rows ({commit.failed.length})
              </summary>
              <ul className="list-disc pl-5 mt-1">
                {commit.failed.map((f, i) => (
                  <li key={i}>
                    Row {f.rowNumber}: {f.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-[12px] text-text-muted">
            Review draft rows at{' '}
            <a
              href="/admin/shooters-world-cip"
              className="text-accent hover:text-accent-hover"
            >
              /admin/shooters-world-cip
            </a>{' '}
            and promote individually after comparing against the cited source.
          </p>
          <p className="text-[12px] text-text-muted">
            Preview how the rows look in the user-facing view:{' '}
            <a
              href="/cip-reference?includeNeedsReview=1"
              className="text-accent hover:text-accent-hover"
              data-testid="cip-bulk-public-preview-link"
            >
              /cip-reference?includeNeedsReview=1
            </a>
            . Non-admins do not see DRAFT rows there until they toggle the
            same option, and the rows are clearly badged{' '}
            <code className="text-accent">draft</code> with an unverified
            warning.
          </p>
        </div>
      )}
    </div>
  );
}
