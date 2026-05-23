'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Import = { id: string; title: string };
type Option = { id: string; label: string };

type Issue = { field?: string; code: string; message: string };

export function PublishedLoadRowDraftForm({
  imports,
  cartridges,
  bullets,
  powders,
  sources,
}: {
  imports: Import[];
  cartridges: Option[];
  bullets: Option[];
  powders: Option[];
  sources?: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);

  const disabled = imports.length === 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);

    const body = {
      importId: (fd.get('importId') as string | null) ?? '',
      sourceId: stringOrNull(fd.get('sourceId')),
      cartridgeId: stringOrNull(fd.get('cartridgeId')),
      bulletComponentId: stringOrNull(fd.get('bulletComponentId')),
      powderComponentId: stringOrNull(fd.get('powderComponentId')),
      pageLabel: stringOrNull(fd.get('pageLabel')),
      bulletWeightGr: numberOrNull(fd.get('bulletWeightGr')),
      bulletName: stringOrNull(fd.get('bulletName')),
      powderName: stringOrNull(fd.get('powderName')),
      chargeGr: numberOrNull(fd.get('chargeGr')),
      velocityFps: numberOrNull(fd.get('velocityFps')),
      isMaxLoad: fd.get('isMaxLoad') === 'on',
      publishedMaxChargeGr: numberOrNull(fd.get('publishedMaxChargeGr')),
      colIn: numberOrNull(fd.get('colIn')),
      bcG1: numberOrNull(fd.get('bcG1')),
      bcG7: numberOrNull(fd.get('bcG7')),
      notes: stringOrNull(fd.get('notes')),
      status: 'NEEDS_REVIEW' as const,
    };

    startTransition(async () => {
      const res = await fetch('/api/published-data-review/rows', {
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
        error?: string;
        issues?: Array<{
          path?: Array<string | number>;
          code?: string;
          message?: string;
        }>;
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
          { code: out.error ?? 'UNKNOWN', message: 'Could not stage row.' },
        ]);
      }
    });
  }

  const formIssues = issues.filter((i) => !i.field);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      data-testid="published-row-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="importId">Review set</label>
          <select
            id="importId"
            name="importId"
            required
            defaultValue=""
            data-testid="published-row-import"
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
          <label htmlFor="pageLabel">Page / table</label>
          <input
            id="pageLabel"
            name="pageLabel"
            type="text"
            placeholder="e.g. p. 2, 65gr table"
            data-testid="published-row-page"
          />
        </div>
        <div>
          <label htmlFor="cartridgeId">Cartridge</label>
          <select
            id="cartridgeId"
            name="cartridgeId"
            defaultValue=""
            data-testid="published-row-cartridge"
          >
            <option value="">—</option>
            {cartridges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {sources && sources.length > 0 && (
          <div>
            <label htmlFor="sourceId">Cited source (override import)</label>
            <select
              id="sourceId"
              name="sourceId"
              defaultValue=""
              data-testid="published-row-source"
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
        <div>
          <label htmlFor="bulletComponentId">Bullet (workspace)</label>
          <select
            id="bulletComponentId"
            name="bulletComponentId"
            defaultValue=""
          >
            <option value="">—</option>
            {bullets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bulletName">Bullet name (free text)</label>
          <input
            id="bulletName"
            name="bulletName"
            type="text"
            placeholder="e.g. 65gr V-MAX"
          />
        </div>
        <div>
          <label htmlFor="bulletWeightGr">Bullet weight (gr)</label>
          <input
            id="bulletWeightGr"
            name="bulletWeightGr"
            type="number"
            step="0.1"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="powderComponentId">Powder (workspace)</label>
          <select
            id="powderComponentId"
            name="powderComponentId"
            defaultValue=""
          >
            <option value="">—</option>
            {powders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="powderName">Powder name (free text)</label>
          <input
            id="powderName"
            name="powderName"
            type="text"
            placeholder="e.g. CFE 223"
          />
        </div>
        <div>
          <label htmlFor="chargeGr">Charge (gr)</label>
          <input
            id="chargeGr"
            name="chargeGr"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="transcribed from source"
            data-testid="published-row-charge"
          />
        </div>
        <div>
          <label htmlFor="velocityFps">Velocity (fps)</label>
          <input
            id="velocityFps"
            name="velocityFps"
            type="number"
            step="1"
            inputMode="numeric"
            data-testid="published-row-velocity"
          />
        </div>
        <div>
          <label htmlFor="colIn">COL (in)</label>
          <input
            id="colIn"
            name="colIn"
            type="number"
            step="0.001"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bcG1">G1 BC</label>
          <input
            id="bcG1"
            name="bcG1"
            type="number"
            step="0.001"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bcG7">G7 BC</label>
          <input
            id="bcG7"
            name="bcG7"
            type="number"
            step="0.001"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="publishedMaxChargeGr">
            Published max charge (gr)
          </label>
          <input
            id="publishedMaxChargeGr"
            name="publishedMaxChargeGr"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="row-specific max from source"
            data-testid="published-row-max-charge"
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-[13px] text-text">
            <input
              type="checkbox"
              name="isMaxLoad"
              data-testid="published-row-ismax"
            />
            Marked max charge in source
          </label>
        </div>
      </div>

      <p
        className="text-[11px] text-text-faint leading-relaxed"
        data-testid="published-row-max-help"
      >
        If you record a <em>Published max charge</em>, that row-specific value
        is what the load draft validator checks against — independent of the
        Source-wide max. If you check <em>Marked max charge in source</em> and
        leave the published max blank, this transcribed row is treated as the
        row maximum after verification (the charge will be used as the row
        max).
      </p>

      <div>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="e.g. footnote on temperature sensitivity"
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

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          disabled={pending || disabled}
          data-testid="published-row-submit"
        >
          {pending ? 'Staging…' : 'Stage row for review'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Saves a user-entered source row draft for verification against the
          original document. Not a recommended load.
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

function numberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = v.toString().trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
