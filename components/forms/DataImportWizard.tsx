'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  parseInventoryRows,
  parseCaseCapacityRows,
  parseBulletMetaRows,
  parsePowderMetaRows,
  type WizardCategory,
  type WizardParseResult,
  type WizardParsedRow,
  type InventoryRow,
  type CaseCapacityRow,
  type BulletMetaRow,
  type PowderMetaRow,
  INVENTORY_HEADER,
  INVENTORY_EXAMPLE,
  CAPACITY_HEADER,
  CAPACITY_EXAMPLE,
  BULLET_META_HEADER,
  BULLET_META_EXAMPLE,
  POWDER_META_HEADER,
  POWDER_META_EXAMPLE,
} from '@/lib/data/importWizardParse';

type CategoryDef = {
  id: WizardCategory;
  label: string;
  short: string;
  description: string;
  badge?: { tone: 'neutral' | 'accent' | 'success' | 'warning'; label: string };
  destinationHref: string;
  destinationLabel: string;
  routes: 'preview-stage' | 'preview-create' | 'route-out';
};

const CATEGORIES: CategoryDef[] = [
  {
    id: 'published',
    label: 'Published manual rows',
    short: 'Manual / charge tables',
    description:
      'Paste transcribed rows from a manufacturer manual, powder maker, or load data sheet. Rows are staged for verification and are never auto-marked safe.',
    badge: { tone: 'warning', label: 'Needs review' },
    destinationHref: '/published-data-review',
    destinationLabel: 'Published-data review',
    routes: 'route-out',
  },
  {
    id: 'chrono',
    label: 'Chronograph data',
    short: 'Chrono shot strings',
    description:
      'Paste a chronograph CSV. Imports become a range session — average velocity, ES, SD. No pressure or charge validation.',
    badge: { tone: 'accent', label: 'Existing pipeline' },
    destinationHref: '/chrono-import',
    destinationLabel: 'Chronograph import',
    routes: 'route-out',
  },
  {
    id: 'inventory',
    label: 'Component inventory',
    short: 'Bullets / powders / primers / cases',
    description:
      'Paste lots and quantities of bullets, powders, primers, or cases. Creates Component records with quantity on hand.',
    badge: { tone: 'success', label: 'Persists' },
    destinationHref: '/components',
    destinationLabel: 'Components',
    routes: 'preview-create',
  },
  {
    id: 'caseCapacity',
    label: 'Case capacity measurements',
    short: 'Brass H₂O capacity',
    description:
      'Paste water/alcohol-fill capacity measurements. Creates solver-input records (recordkeeping only — nothing reads them yet).',
    badge: { tone: 'success', label: 'Persists' },
    destinationHref: '/solver-inputs',
    destinationLabel: 'Solver inputs',
    routes: 'preview-create',
  },
  {
    id: 'bulletMeta',
    label: 'Bullet metadata',
    short: 'Bullet dimensions / BC',
    description:
      'Paste bullet identity and measurements. Creates bullet-dimension solver-input records.',
    badge: { tone: 'success', label: 'Persists' },
    destinationHref: '/solver-inputs',
    destinationLabel: 'Solver inputs',
    routes: 'preview-create',
  },
  {
    id: 'powderMeta',
    label: 'Powder metadata',
    short: 'Powder identity / density',
    description:
      'Paste powder identity, density, and burn metadata. Creates powder-metadata solver-input records.',
    badge: { tone: 'success', label: 'Persists' },
    destinationHref: '/solver-inputs',
    destinationLabel: 'Solver inputs',
    routes: 'preview-create',
  },
];

type AnyValues = InventoryRow | CaseCapacityRow | BulletMetaRow | PowderMetaRow;
type AnyResult = WizardParseResult<AnyValues>;

export function DataImportWizard({ initial }: { initial?: WizardCategory }) {
  const [category, setCategory] = useState<WizardCategory>(initial ?? 'published');
  const def = CATEGORIES.find((c) => c.id === category)!;

  return (
    <div className="space-y-5" data-testid="data-import-wizard">
      <CategoryPicker selected={category} onSelect={setCategory} />

      <div
        className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[12px] text-text leading-relaxed"
        data-testid="data-import-safety"
      >
        <strong className="font-semibold">
          Imports are user-entered records, not load advice.
        </strong>{' '}
        LoadBench Pro does not predict pressure, recommend charges, or label any
        row safe. Published-manual rows imported here land as{' '}
        <em>needs review</em> and must be verified against the original
        manufacturer/source document before being cited on a load. See the{' '}
        <Link href="/safety" className="text-accent hover:text-accent-hover">
          safety policy
        </Link>
        .
      </div>

      <StepIntro def={def} />

      {category === 'published' && <PublishedRouteOut />}
      {category === 'chrono' && <ChronoRouteOut />}
      {category === 'inventory' && <InventoryStep />}
      {category === 'caseCapacity' && <CaseCapacityStep />}
      {category === 'bulletMeta' && <BulletMetaStep />}
      {category === 'powderMeta' && <PowderMetaStep />}
    </div>
  );
}

function CategoryPicker({
  selected,
  onSelect,
}: {
  selected: WizardCategory;
  onSelect: (c: WizardCategory) => void;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-text-faint font-medium mb-2">
        Step 1 · Choose data type
      </div>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
        data-testid="data-import-category-list"
      >
        {CATEGORIES.map((c) => {
          const active = c.id === selected;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => onSelect(c.id)}
              data-testid={`data-import-category-${c.id}`}
              data-active={active ? 'true' : 'false'}
              className={
                'text-left rounded-md border px-3 py-2 transition-colors ' +
                (active
                  ? 'border-accent bg-bg-alt'
                  : 'border-border bg-bg-surface hover:border-border-strong')
              }
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="text-[13px] font-medium text-text truncate">
                  {c.label}
                </div>
                {c.badge && <Badge tone={c.badge.tone}>{c.badge.label}</Badge>}
              </div>
              <div className="text-[11px] text-text-muted">{c.short}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepIntro({ def }: { def: CategoryDef }) {
  return (
    <div className="rounded-md border border-border bg-bg-alt/40 px-4 py-3 text-[12px] text-text-muted">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] uppercase tracking-wider text-text-faint font-medium">
          Step 2 · {def.label}
        </span>
        {def.badge && <Badge tone={def.badge.tone}>{def.badge.label}</Badge>}
      </div>
      <p className="leading-relaxed">{def.description}</p>
      <p className="text-[11px] text-text-faint mt-1">
        Destination:{' '}
        <Link
          href={def.destinationHref}
          className="text-accent hover:text-accent-hover"
        >
          {def.destinationLabel}
        </Link>
      </p>
    </div>
  );
}

function PublishedRouteOut() {
  return (
    <div className="space-y-3" data-testid="data-import-route-published">
      <div className="rounded-md border border-border bg-bg-surface p-4 text-[12px] text-text-muted leading-relaxed">
        <p className="text-text mb-2 font-medium">
          This category routes to the existing batch entry on Published-data
          review.
        </p>
        <p>
          That page already supports paste CSV/TSV → preview → stage as{' '}
          <em>needs review</em>. Rows are NEVER auto-verified and a Load draft
          can only be created from a row a workspace member has marked verified
          against the original document.
        </p>
        <p className="mt-2">
          You will need a <em>review set</em> first (a container that groups
          staged rows under one published source). Create one on the same page.
        </p>
      </div>
      <div className="rounded-md border border-border bg-bg-alt/30 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-text-faint font-medium mb-1">
          CSV header (copy)
        </div>
        <pre
          className="font-mono text-[11px] text-text overflow-x-auto whitespace-pre"
          data-testid="data-import-published-header"
        >{`bullet,powder,velocityFps,chargeGr,publishedMaxChargeGr,isMaxLoad,colIn,pageLabel,notes`}</pre>
      </div>
      <div className="flex gap-2 items-center">
        <Link href="/published-data-review">
          <Button data-testid="data-import-open-published">
            Open published-data review
          </Button>
        </Link>
        <span className="text-[11px] text-text-faint">
          Rows land as needs review — never auto-verified.
        </span>
      </div>
    </div>
  );
}

function ChronoRouteOut() {
  return (
    <div className="space-y-3" data-testid="data-import-route-chrono">
      <div className="rounded-md border border-border bg-bg-surface p-4 text-[12px] text-text-muted leading-relaxed">
        <p className="text-text mb-2 font-medium">
          Chronograph CSV import is its own page — it ties shots to a load and
          a range session.
        </p>
        <p>
          The existing importer parses <code>shot,velocityFps,note</code>{' '}
          headers (case-insensitive aliases like <code>fps</code>,{' '}
          <code>velocity</code> are accepted). Imports become a new range
          session with average velocity, ES, SD, and shots fired.
        </p>
      </div>
      <div className="rounded-md border border-border bg-bg-alt/30 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-text-faint font-medium mb-1">
          CSV header (copy)
        </div>
        <pre
          className="font-mono text-[11px] text-text overflow-x-auto whitespace-pre"
          data-testid="data-import-chrono-header"
        >{`shot,velocityFps,note`}</pre>
      </div>
      <div className="flex gap-2 items-center">
        <Link href="/chrono-import">
          <Button data-testid="data-import-open-chrono">
            Open chronograph import
          </Button>
        </Link>
        <span className="text-[11px] text-text-faint">
          You will pick the target load and rifle there.
        </span>
      </div>
    </div>
  );
}

// ---------- Persisting steps ----------

type StagedSummary = {
  created: number;
  total: number;
  failed: Array<{ rowNumber: number; message: string }>;
};

type RowOf<V> = WizardParsedRow<V>;

function PersistingStep<V extends Record<string, unknown>>({
  testId,
  header,
  example,
  parse,
  renderRow,
  columns,
  postBody,
  postUrl,
  successCopy,
  destinationHref,
  destinationLabel,
}: {
  testId: string;
  header: string;
  example: string;
  parse: (text: string) => WizardParseResult<V>;
  renderRow: (r: RowOf<V>) => React.ReactNode;
  columns: string[];
  postBody: (row: RowOf<V>) => Record<string, unknown>;
  postUrl: string;
  successCopy: string;
  destinationHref: string;
  destinationLabel: string;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<WizardParseResult<V> | null>(null);
  const [pending, startTransition] = useTransition();
  const [stageError, setStageError] = useState<string | null>(null);
  const [summary, setSummary] = useState<StagedSummary | null>(null);

  const validRows = useMemo(
    () => (preview ? preview.rows.filter((r) => r.errors.length === 0) : []),
    [preview],
  );
  const errorCount = preview
    ? preview.rows.reduce((n, r) => n + (r.errors.length > 0 ? 1 : 0), 0)
    : 0;
  const warningCount = preview
    ? preview.rows.reduce((n, r) => n + (r.warnings.length > 0 ? 1 : 0), 0)
    : 0;

  function handlePreview() {
    setStageError(null);
    setSummary(null);
    setPreview(parse(text));
  }

  function handleSave() {
    if (validRows.length === 0) return;
    setStageError(null);

    startTransition(async () => {
      const failed: Array<{ rowNumber: number; message: string }> = [];
      let created = 0;
      for (const row of validRows) {
        try {
          const res = await fetch(postUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(postBody(row)),
          });
          if (res.ok) {
            created++;
          } else {
            const out = (await res.json().catch(() => ({}))) as {
              error?: string;
              issues?: Array<{ message?: string }>;
            };
            failed.push({
              rowNumber: row.rowNumber,
              message:
                out.issues?.[0]?.message ??
                out.error ??
                `HTTP ${res.status}`,
            });
          }
        } catch (e) {
          failed.push({
            rowNumber: row.rowNumber,
            message: e instanceof Error ? e.message : 'network error',
          });
        }
      }
      setSummary({ created, total: validRows.length, failed });
      if (created === validRows.length) {
        setText('');
        setPreview(null);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-text-faint font-medium mb-1">
          Step 3 · CSV header (copy)
        </div>
        <pre
          className="font-mono text-[11px] text-text bg-bg-alt/30 border border-border rounded px-3 py-2 overflow-x-auto whitespace-pre"
          data-testid={`${testId}-header`}
        >
          {header}
        </pre>
        <details className="mt-2">
          <summary className="text-[11px] text-accent hover:text-accent-hover cursor-pointer">
            Show example
          </summary>
          <pre
            className="font-mono text-[11px] text-text-muted bg-bg-alt/20 border border-border rounded px-3 py-2 overflow-x-auto whitespace-pre mt-1"
            data-testid={`${testId}-example`}
          >
            {example}
          </pre>
          <button
            type="button"
            className="text-[11px] text-accent hover:text-accent-hover mt-1"
            onClick={() => setText(example)}
            data-testid={`${testId}-load-example`}
          >
            Load example into editor
          </button>
        </details>
      </div>

      <div>
        <label
          htmlFor={`${testId}-text`}
          className="text-[12px] font-medium text-text"
        >
          Step 4 · Paste CSV/TSV
        </label>
        <textarea
          id={`${testId}-text`}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="font-mono text-[12px] mt-1"
          placeholder="Paste rows here"
          data-testid={`${testId}-textarea`}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant="secondary"
          onClick={handlePreview}
          disabled={text.trim() === ''}
          data-testid={`${testId}-preview`}
        >
          Step 5 · Preview rows
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={pending || !preview || validRows.length === 0}
          data-testid={`${testId}-save`}
        >
          {pending
            ? 'Saving…'
            : `Step 6 · Save ${validRows.length} row${validRows.length === 1 ? '' : 's'}`}
        </Button>
        <Link
          href={destinationHref}
          className="text-[11px] text-text-faint hover:text-accent"
        >
          Open {destinationLabel} →
        </Link>
      </div>

      {preview?.fatalError && (
        <div
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
          data-testid={`${testId}-fatal`}
        >
          {preview.fatalError}
        </div>
      )}

      {preview && preview.rows.length > 0 && (
        <div className="space-y-2">
          <div className="text-[12px] text-text-muted flex flex-wrap gap-x-4 gap-y-1">
            <span data-testid={`${testId}-summary-total`}>
              Parsed: {preview.rows.length}
            </span>
            <span data-testid={`${testId}-summary-valid`}>
              Valid: {validRows.length}
            </span>
            <span data-testid={`${testId}-summary-errors`}>
              Errors: {errorCount}
            </span>
            <span data-testid={`${testId}-summary-warnings`}>
              Warnings: {warningCount}
            </span>
            <span>Header detected: {preview.headerDetected ? 'yes' : 'no'}</span>
          </div>
          <div className="overflow-x-auto">
            <table
              className="w-full text-[12px]"
              data-testid={`${testId}-preview-table`}
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                  <th>Issues</th>
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
                      data-status={status}
                      data-testid={`${testId}-row-${r.rowNumber}`}
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
                      {renderRow(r)}
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
          data-testid={`${testId}-save-error`}
        >
          {stageError}
        </div>
      )}

      {summary && (
        <div
          className={
            summary.failed.length === 0
              ? 'rounded-md border border-success/40 bg-success-subtle px-4 py-2 text-[12px] text-text'
              : 'rounded-md border border-warning/40 bg-warning-subtle px-4 py-2 text-[12px] text-text'
          }
          data-testid={`${testId}-save-result`}
        >
          {successCopy.replace('{n}', summary.created.toString()).replace(
            '{total}',
            summary.total.toString(),
          )}
          {summary.failed.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {summary.failed.slice(0, 10).map((f) => (
                <li key={f.rowNumber}>
                  Row {f.rowNumber}: {f.message}
                </li>
              ))}
              {summary.failed.length > 10 && (
                <li>+ {summary.failed.length - 10} more…</li>
              )}
            </ul>
          )}
          <div className="mt-1">
            <Link
              href={destinationHref}
              className="text-accent hover:text-accent-hover"
            >
              Open {destinationLabel} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryStep() {
  return (
    <PersistingStep<InventoryRow>
      testId="data-import-inventory"
      header={INVENTORY_HEADER}
      example={INVENTORY_EXAMPLE}
      parse={parseInventoryRows}
      columns={['Kind', 'Mfg', 'Model', 'Lot', 'Qty', 'Unit']}
      renderRow={(r) => (
        <>
          <td>{r.values.kind ?? '—'}</td>
          <td>{r.values.manufacturer ?? '—'}</td>
          <td>{r.values.model ?? '—'}</td>
          <td>{r.values.lotNumber ?? '—'}</td>
          <td className="text-right">{r.values.quantityOnHand ?? '—'}</td>
          <td>{r.values.unit ?? '—'}</td>
        </>
      )}
      postUrl="/api/components"
      postBody={(r) => ({
        kind: r.values.kind,
        manufacturer: r.values.manufacturer,
        model: r.values.model,
        lotNumber: r.values.lotNumber,
        quantityOnHand: r.values.quantityOnHand,
        unit: r.values.unit,
        bulletWeightGr: r.values.bulletWeightGr,
        bulletBc: r.values.bulletBc,
        burnRateLabel: r.values.burnRateLabel,
        notes: r.values.notes,
      })}
      successCopy="Created {n} of {total} component record(s)."
      destinationHref="/components"
      destinationLabel="Components"
    />
  );
}

function CaseCapacityStep() {
  return (
    <PersistingStep<CaseCapacityRow>
      testId="data-import-case-capacity"
      header={CAPACITY_HEADER}
      example={CAPACITY_EXAMPLE}
      parse={parseCaseCapacityRows}
      columns={['Cartridge', 'Brass', 'Lot', 'Method', 'State', 'Avg gr', 'n']}
      renderRow={(r) => (
        <>
          <td>{r.values.cartridgeName ?? '—'}</td>
          <td>
            {[r.values.brassManufacturer, r.values.brassModel]
              .filter(Boolean)
              .join(' ') || '—'}
          </td>
          <td>{r.values.lotNumber ?? '—'}</td>
          <td>{r.values.method ?? '—'}</td>
          <td>{r.values.firedOrResized ?? '—'}</td>
          <td className="text-right">
            {r.values.avgCapacityGr ?? r.values.waterCapacityGr ?? '—'}
          </td>
          <td className="text-right">{r.values.sampleCount ?? '—'}</td>
        </>
      )}
      postUrl="/api/solver-inputs/case-capacity"
      postBody={(r) => ({
        lotNumber: r.values.lotNumber,
        method: r.values.method,
        firedOrResized: r.values.firedOrResized,
        waterCapacityGr: r.values.waterCapacityGr,
        avgCapacityGr: r.values.avgCapacityGr,
        sdCapacityGr: r.values.sdCapacityGr,
        sampleCount: r.values.sampleCount,
        tempF: r.values.tempF,
        notes:
          [
            r.values.cartridgeName
              ? `cartridge=${r.values.cartridgeName}`
              : null,
            r.values.brassManufacturer
              ? `brass=${r.values.brassManufacturer} ${r.values.brassModel ?? ''}`.trim()
              : null,
            r.values.notes,
          ]
            .filter(Boolean)
            .join(' · ') || null,
      })}
      successCopy="Created {n} of {total} case-capacity record(s)."
      destinationHref="/solver-inputs"
      destinationLabel="Solver inputs"
    />
  );
}

function BulletMetaStep() {
  return (
    <PersistingStep<BulletMetaRow>
      testId="data-import-bullet-meta"
      header={BULLET_META_HEADER}
      example={BULLET_META_EXAMPLE}
      parse={parseBulletMetaRows}
      columns={['Mfg', 'Model', 'Wt gr', 'Dia in', 'Len in', 'G1', 'G7']}
      renderRow={(r) => (
        <>
          <td>{r.values.manufacturer ?? '—'}</td>
          <td>{r.values.model ?? '—'}</td>
          <td className="text-right">{r.values.weightGr ?? '—'}</td>
          <td className="text-right">{r.values.diameterIn ?? '—'}</td>
          <td className="text-right">{r.values.lengthIn ?? '—'}</td>
          <td className="text-right">{r.values.bcG1 ?? '—'}</td>
          <td className="text-right">{r.values.bcG7 ?? '—'}</td>
        </>
      )}
      postUrl="/api/solver-inputs/bullet-dimensions"
      postBody={(r) => ({
        manufacturer: r.values.manufacturer,
        model: r.values.model,
        lotNumber: r.values.lotNumber,
        weightGr: r.values.weightGr,
        diameterIn: r.values.diameterIn,
        lengthIn: r.values.lengthIn,
        bearingSurfaceIn: r.values.bearingSurfaceIn,
        boatTailLengthIn: r.values.boatTailLengthIn,
        ogiveStyle: r.values.ogiveStyle,
        bcG1: r.values.bcG1,
        bcG7: r.values.bcG7,
        sampleCount: r.values.sampleCount,
        notes: r.values.notes,
      })}
      successCopy="Created {n} of {total} bullet-dimension record(s)."
      destinationHref="/solver-inputs"
      destinationLabel="Solver inputs"
    />
  );
}

function PowderMetaStep() {
  return (
    <PersistingStep<PowderMetaRow>
      testId="data-import-powder-meta"
      header={POWDER_META_HEADER}
      example={POWDER_META_EXAMPLE}
      parse={parsePowderMetaRows}
      columns={['Mfg', 'Powder', 'Lot', 'Burn', 'Density g/cc', 'Bulk gr/cc']}
      renderRow={(r) => (
        <>
          <td>{r.values.manufacturer ?? '—'}</td>
          <td>{r.values.powderName ?? '—'}</td>
          <td>{r.values.lotNumber ?? '—'}</td>
          <td>{r.values.burnRateLabel ?? '—'}</td>
          <td className="text-right">{r.values.densityGcc ?? '—'}</td>
          <td className="text-right">{r.values.bulkDensityGrPerCc ?? '—'}</td>
        </>
      )}
      postUrl="/api/solver-inputs/powder-metadata"
      postBody={(r) => ({
        manufacturer: r.values.manufacturer,
        powderName: r.values.powderName,
        lotNumber: r.values.lotNumber,
        burnRateLabel: r.values.burnRateLabel,
        densityGcc: r.values.densityGcc,
        bulkDensityGrPerCc: r.values.bulkDensityGrPerCc,
        kernelShape: r.values.kernelShape,
        tempSensitivityNotes: r.values.tempSensitivityNotes,
        notes: r.values.notes,
      })}
      successCopy="Created {n} of {total} powder-metadata record(s)."
      destinationHref="/solver-inputs"
      destinationLabel="Solver inputs"
    />
  );
}
