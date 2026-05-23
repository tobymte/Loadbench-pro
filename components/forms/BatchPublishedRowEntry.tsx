'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  parseBatchPublishedRows,
  type ComponentOption,
  type ParseBatchResult,
} from '@/lib/data/publishedRowBatchParse';

type Import = { id: string; title: string };
type Option = { id: string; label: string };

const EXAMPLE = `bullet,powder,velocityFps,chargeGr,publishedMaxChargeGr,isMaxLoad,colIn,pageLabel,notes
58 gr V-MAX,H322,3300,30.0,30.0,true,2.085,p.1,transcribed from table
58 gr V-MAX,CFE 223,3250,28.5,29.0,false,2.085,p.1,`;

export function BatchPublishedRowEntry({
  imports,
  cartridges,
  bullets,
  powders,
  sources,
}: {
  imports: Import[];
  cartridges: Option[];
  bullets: ComponentOption[];
  powders: ComponentOption[];
  sources: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState('');
  const [importId, setImportId] = useState<string>('');
  const [cartridgeId, setCartridgeId] = useState<string>('');
  const [sourceId, setSourceId] = useState<string>('');
  const [preview, setPreview] = useState<ParseBatchResult | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageResult, setStageResult] = useState<
    | {
        created: number;
        total: number;
        skipped: number;
        rowErrors: Array<{
          rowIndex: number;
          issues: Array<{ field?: string; message: string }>;
        }>;
      }
    | null
  >(null);

  const disabled = imports.length === 0;

  const validRows = useMemo(
    () => (preview ? preview.rows.filter((r) => r.errors.length === 0) : []),
    [preview],
  );

  function handlePreview() {
    setStageResult(null);
    setStageError(null);
    const result = parseBatchPublishedRows(text, { bullets, powders });
    setPreview(result);
  }

  function handleStage() {
    if (!preview || validRows.length === 0 || !importId) return;
    setStageError(null);

    const body = {
      importId,
      sourceId: sourceId || null,
      cartridgeId: cartridgeId || null,
      rows: validRows.map((r) => ({
        bulletComponentId: r.values.bulletComponentId,
        powderComponentId: r.values.powderComponentId,
        bulletName: r.values.bulletName,
        powderName: r.values.powderName,
        chargeGr: r.values.chargeGr,
        velocityFps: r.values.velocityFps,
        publishedMaxChargeGr: r.values.publishedMaxChargeGr,
        isMaxLoad: r.values.isMaxLoad,
        colIn: r.values.colIn,
        pageLabel: r.values.pageLabel,
        notes: r.values.notes,
      })),
    };

    startTransition(async () => {
      const res = await fetch('/api/published-data-review/rows/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => ({}))) as {
        created?: number;
        total?: number;
        skipped?: number;
        rowErrors?: Array<{
          rowIndex: number;
          issues: Array<{ field?: string; message: string }>;
        }>;
        error?: string;
        issues?: Array<{ message?: string; path?: Array<string | number> }>;
      };
      if (!res.ok) {
        const first =
          out.issues?.[0]?.message ??
          out.error ??
          'Could not stage batch.';
        setStageError(first);
        return;
      }
      setStageResult({
        created: out.created ?? 0,
        total: out.total ?? validRows.length,
        skipped: out.skipped ?? 0,
        rowErrors: out.rowErrors ?? [],
      });
      // Clear textarea and preview only if everything staged cleanly.
      if ((out.created ?? 0) === validRows.length) {
        setText('');
        setPreview(null);
      }
      router.refresh();
    });
  }

  const errorCount = preview
    ? preview.rows.reduce((n, r) => n + (r.errors.length > 0 ? 1 : 0), 0)
    : 0;
  const warningCount = preview
    ? preview.rows.reduce((n, r) => n + (r.warnings.length > 0 ? 1 : 0), 0)
    : 0;

  return (
    <div className="space-y-4" data-testid="published-batch-section">
      <div
        className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-2 text-[12px] text-text"
        data-testid="published-batch-notice"
      >
        <strong className="font-semibold">
          Batch staging does not verify rows.
        </strong>{' '}
        Every staged row must be checked against the original source before
        use. Rows are created as <em>needs review</em> — never verified — and
        no Load record is created here.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="batchImportId">Review set</label>
          <select
            id="batchImportId"
            value={importId}
            onChange={(e) => setImportId(e.target.value)}
            required
            data-testid="published-batch-import"
          >
            <option value="" disabled>
              {imports.length === 0 ? 'Stage a set first…' : 'Select…'}
            </option>
            {imports.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="batchCartridgeId">Cartridge (optional)</label>
          <select
            id="batchCartridgeId"
            value={cartridgeId}
            onChange={(e) => setCartridgeId(e.target.value)}
            data-testid="published-batch-cartridge"
          >
            <option value="">—</option>
            {cartridges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {sources.length > 0 && (
          <div>
            <label htmlFor="batchSourceId">
              Cited source (override review set)
            </label>
            <select
              id="batchSourceId"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              data-testid="published-batch-source"
            >
              <option value="">— inherit from review set —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="batchText">Paste rows (CSV or TSV)</label>
        <textarea
          id="batchText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="font-mono text-[12px]"
          placeholder={EXAMPLE}
          data-testid="published-batch-textarea"
        />
        <p className="text-[11px] text-text-faint mt-1 leading-relaxed">
          Header row is recommended. Supported columns: <code>bullet</code>,{' '}
          <code>powder</code>, <code>velocityFps</code>, <code>chargeGr</code>,{' '}
          <code>publishedMaxChargeGr</code>, <code>isMaxLoad</code>,{' '}
          <code>colIn</code>, <code>pageLabel</code>, <code>notes</code>{' '}
          (aliases like <code>velocity</code>, <code>charge</code>,{' '}
          <code>max</code>, <code>isMax</code>, <code>coal</code>,{' '}
          <code>page</code> are also accepted).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={handlePreview}
          disabled={disabled || text.trim() === ''}
          data-testid="published-batch-preview"
        >
          Preview rows
        </Button>
        <Button
          type="button"
          onClick={handleStage}
          disabled={
            disabled ||
            pending ||
            !preview ||
            validRows.length === 0 ||
            !importId
          }
          data-testid="published-batch-stage"
        >
          {pending
            ? 'Staging…'
            : `Stage ${validRows.length} row${validRows.length === 1 ? '' : 's'} for review`}
        </Button>
        <span className="text-[11px] text-text-faint">
          Staging creates drafts only; nothing is marked verified.
        </span>
      </div>

      {preview?.fatalError && (
        <div
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
          data-testid="published-batch-fatal"
        >
          {preview.fatalError}
        </div>
      )}

      {preview && preview.rows.length > 0 && (
        <div className="space-y-2">
          <div className="text-[12px] text-text-muted flex flex-wrap gap-x-4 gap-y-1">
            <span data-testid="published-batch-summary-total">
              Parsed: {preview.rows.length}
            </span>
            <span data-testid="published-batch-summary-valid">
              Valid: {validRows.length}
            </span>
            <span data-testid="published-batch-summary-errors">
              Errors: {errorCount}
            </span>
            <span data-testid="published-batch-summary-warnings">
              Warnings: {warningCount}
            </span>
            <span>
              Header detected: {preview.headerDetected ? 'yes' : 'no'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table
              className="w-full text-[12px]"
              data-testid="published-batch-preview-table"
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  <th>Bullet</th>
                  <th>Powder</th>
                  <th className="text-right">Charge</th>
                  <th className="text-right">Velocity</th>
                  <th className="text-right">Row max</th>
                  <th>Max?</th>
                  <th>COL</th>
                  <th>Page</th>
                  <th>Notes / Issues</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => {
                  const status =
                    r.errors.length > 0
                      ? 'invalid'
                      : r.warnings.length > 0
                        ? 'warning'
                        : 'valid';
                  return (
                    <tr
                      key={r.rowNumber}
                      data-testid={`published-batch-preview-row-${r.rowNumber}`}
                      data-status={status}
                    >
                      <td>{r.rowNumber}</td>
                      <td>
                        {status === 'invalid' && (
                          <span className="text-danger">invalid</span>
                        )}
                        {status === 'warning' && (
                          <span className="text-warning">warn</span>
                        )}
                        {status === 'valid' && (
                          <span className="text-success">ok</span>
                        )}
                      </td>
                      <td>
                        {r.values.bulletName ?? '—'}
                        {r.values.bulletComponentId && (
                          <span className="text-[10px] text-text-faint ml-1">
                            (matched)
                          </span>
                        )}
                      </td>
                      <td>
                        {r.values.powderName ?? '—'}
                        {r.values.powderComponentId && (
                          <span className="text-[10px] text-text-faint ml-1">
                            (matched)
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        {r.values.chargeGr ?? '—'}
                      </td>
                      <td className="text-right">
                        {r.values.velocityFps ?? '—'}
                      </td>
                      <td className="text-right">
                        {r.values.publishedMaxChargeGr ?? '—'}
                      </td>
                      <td>{r.values.isMaxLoad ? 'max' : '—'}</td>
                      <td>{r.values.colIn ?? '—'}</td>
                      <td>{r.values.pageLabel ?? '—'}</td>
                      <td>
                        {r.errors.length > 0 && (
                          <ul className="text-danger">
                            {r.errors.map((e, i) => (
                              <li key={`e${i}`}>
                                {e.field ? `${e.field}: ` : ''}
                                {e.message}
                              </li>
                            ))}
                          </ul>
                        )}
                        {r.warnings.length > 0 && (
                          <ul className="text-warning">
                            {r.warnings.map((w, i) => (
                              <li key={`w${i}`}>{w.message}</li>
                            ))}
                          </ul>
                        )}
                        {r.errors.length === 0 &&
                          r.warnings.length === 0 &&
                          (r.values.notes ?? '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stageError && (
        <div
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
          data-testid="published-batch-stage-error"
        >
          {stageError}
        </div>
      )}

      {stageResult && (
        <div
          className="rounded-md border border-success/40 bg-success-subtle px-4 py-2 text-[12px] text-text"
          data-testid="published-batch-stage-result"
        >
          Staged {stageResult.created} of {stageResult.total} row
          {stageResult.total === 1 ? '' : 's'} as <em>needs review</em>.
          {stageResult.skipped > 0 && (
            <> {stageResult.skipped} skipped (see preview errors).</>
          )}{' '}
          Verify each row against the original source before any downstream
          use.
        </div>
      )}
    </div>
  );
}
