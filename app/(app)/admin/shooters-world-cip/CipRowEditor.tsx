// Inline editor for a single CipReferenceRecord row, rendered inside the
// admin Shooters World / CIP page under each draft / pending / retired row.
//
// SAFETY: edits METADATA only. Never accepts predictedPressurePsi,
// recommendedCharge, safeOrUnsafe, etc. — those keys are rejected by the
// PATCH endpoint defence-in-depth via findForbiddenKeys. The "Save and
// verify" button is a separate two-step flow: save first, then verify with an
// explicit acknowledgement checkbox.

import {
  CIP_PRESSURE_UNITS,
  CIP_VOLUME_UNITS,
  CIP_VERIFY_REQUIRED_FIELDS,
  type CipPressureUnit,
  type CipVerificationStatus,
  type CipVolumeUnit,
} from '@/lib/validation/cipReference';

export type CipRowEditorRecord = {
  id: string;
  cartridgeName: string;
  cartridgeCaliberLabel: string | null;
  powderManufacturer: string | null;
  powderFamily: string | null;
  powderName: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  sourceRevision: string | null;
  sourceDate: Date | null;
  pmaxValue: number | null;
  pmaxUnit: CipPressureUnit | null;
  referenceChamberVolume: number | null;
  referenceCombustionVolume: number | null;
  volumeUnit: CipVolumeUnit | null;
  riflingF: number | null;
  riflingZ: number | null;
  riflingG: number | null;
  notes: string | null;
  verificationStatus: CipVerificationStatus;
};

function dateInputValue(d: Date | null): string {
  if (!d) return '';
  // toISOString() returns UTC ISO; slice to YYYY-MM-DD for <input type="date">.
  return d.toISOString().slice(0, 10);
}

function numberInputValue(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '';
  return String(n);
}

function stringInputValue(s: string | null): string {
  return s ?? '';
}

// Returns the list of required-for-VERIFIED fields that are currently empty.
// Surfaced in the editor header so the operator can see at a glance what is
// blocking verification.
export function missingRequiredFields(r: CipRowEditorRecord): string[] {
  const missing: string[] = [];
  for (const k of CIP_VERIFY_REQUIRED_FIELDS) {
    const v = r[k as keyof CipRowEditorRecord];
    if (v == null || (typeof v === 'string' && v.trim().length === 0)) {
      missing.push(k);
    }
  }
  return missing;
}

export function CipRowEditor({ record }: { record: CipRowEditorRecord }) {
  const missing = missingRequiredFields(record);
  const verified = record.verificationStatus === 'VERIFIED';
  const id = record.id;

  return (
    <details
      className="rounded-md border border-border bg-bg-alt mt-2"
      data-testid={`cip-editor-${id}`}
    >
      <summary className="px-3 py-2 cursor-pointer text-[12px] text-text-muted hover:text-text flex items-center justify-between gap-2">
        <span>
          {verified ? 'View fields' : 'Edit & verify'}{' '}
          {missing.length > 0 && (
            <span
              className="ml-2 text-danger"
              data-testid={`cip-editor-missing-${id}`}
            >
              missing: {missing.join(', ')}
            </span>
          )}
        </span>
        <span className="text-text-faint text-[11px]">
          {verified
            ? 'VERIFIED — edits remain possible but use sparingly'
            : 'Provide missing fields, then verify'}
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-3">
        <form
          method="post"
          action={`/api/admin/cip-reference/records/${id}`}
          className="space-y-3"
          data-testid={`cip-editor-form-${id}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>
                Cartridge name *
                {missing.includes('cartridgeName') && (
                  <span className="text-danger ml-1">(required)</span>
                )}
              </span>
              <input
                type="text"
                name="cartridgeName"
                defaultValue={stringInputValue(record.cartridgeName)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Caliber label</span>
              <input
                type="text"
                name="cartridgeCaliberLabel"
                defaultValue={stringInputValue(record.cartridgeCaliberLabel)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Powder manufacturer</span>
              <input
                type="text"
                name="powderManufacturer"
                defaultValue={stringInputValue(record.powderManufacturer)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Powder family</span>
              <input
                type="text"
                name="powderFamily"
                defaultValue={stringInputValue(record.powderFamily)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Powder name</span>
              <input
                type="text"
                name="powderName"
                defaultValue={stringInputValue(record.powderName)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>
                Source URL (cip-bob.org)
                {missing.includes('sourceUrl') && (
                  <span className="text-danger ml-1">(required for VERIFIED)</span>
                )}
              </span>
              <input
                type="url"
                name="sourceUrl"
                defaultValue={stringInputValue(record.sourceUrl)}
                placeholder="https://cip-bob.org/…"
                className={`h-8 px-2 rounded border bg-bg text-[13px] text-text ${
                  missing.includes('sourceUrl') ? 'border-danger' : 'border-border'
                }`}
                data-testid={`cip-editor-sourceUrl-${id}`}
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Source label</span>
              <input
                type="text"
                name="sourceLabel"
                defaultValue={stringInputValue(record.sourceLabel)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Source revision</span>
              <input
                type="text"
                name="sourceRevision"
                defaultValue={stringInputValue(record.sourceRevision)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Source date</span>
              <input
                type="date"
                name="sourceDate"
                defaultValue={dateInputValue(record.sourceDate)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Pmax value</span>
              <input
                type="number"
                name="pmaxValue"
                step="any"
                defaultValue={numberInputValue(record.pmaxValue)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Pmax unit</span>
              <select
                name="pmaxUnit"
                defaultValue={record.pmaxUnit ?? ''}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              >
                <option value="">—</option>
                {CIP_PRESSURE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Reference chamber volume</span>
              <input
                type="number"
                name="referenceChamberVolume"
                step="any"
                defaultValue={numberInputValue(record.referenceChamberVolume)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Reference combustion volume</span>
              <input
                type="number"
                name="referenceCombustionVolume"
                step="any"
                defaultValue={numberInputValue(record.referenceCombustionVolume)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Volume unit</span>
              <select
                name="volumeUnit"
                defaultValue={record.volumeUnit ?? ''}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              >
                <option value="">—</option>
                {CIP_VOLUME_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Rifling F</span>
              <input
                type="number"
                name="riflingF"
                step="any"
                defaultValue={numberInputValue(record.riflingF)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Rifling Z</span>
              <input
                type="number"
                name="riflingZ"
                step="any"
                defaultValue={numberInputValue(record.riflingZ)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-muted">
              <span>Rifling G</span>
              <input
                type="number"
                name="riflingG"
                step="any"
                defaultValue={numberInputValue(record.riflingG)}
                className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-text-muted">
            <span>
              Notes
              <span className="text-text-faint ml-1">
                (bulk-import suffixes like CASE=…, COAL=…, MAX load=…, MAX vel=…
                are preserved here — keep them when editing)
              </span>
            </span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={stringInputValue(record.notes)}
              className="px-2 py-1 rounded border border-border bg-bg text-[13px] text-text font-mono"
            />
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="submit"
              className="h-7 px-3 rounded bg-bg border border-border text-[12px] text-text hover:text-accent"
              data-testid={`cip-editor-save-${id}`}
            >
              Save draft
            </button>
          </div>
        </form>

        {!verified && (
          <form
            method="post"
            action="/api/admin/cip-reference/verify"
            className="border-t border-border pt-3 space-y-2"
            data-testid={`cip-editor-verify-form-${id}`}
          >
            <input type="hidden" name="recordId" value={id} />
            <p className="text-[12px] text-text-muted">
              <strong>Verification is a separate step.</strong> Save the row
              first if you edited any field above; then promote to VERIFIED
              below. Verification requires a non-empty source URL and an
              explicit acknowledgement.
            </p>
            {missing.length > 0 && (
              <p
                className="text-[12px] text-danger"
                data-testid={`cip-editor-blocked-${id}`}
              >
                Cannot verify yet — missing required field(s):{' '}
                {missing.join(', ')}. Fill them in, save the row, then verify.
              </p>
            )}
            <label className="flex items-start gap-2 text-[12px] text-text-muted">
              <input
                type="checkbox"
                name="acknowledgedVerifiedAgainstSource"
                data-testid={`cip-editor-ack-${id}`}
              />
              <span>
                I have compared this row against the cited source and confirm
                the published values are transcribed correctly.
              </span>
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={missing.length > 0}
                className="h-7 px-3 rounded bg-success text-bg text-[12px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`cip-editor-verify-${id}`}
              >
                Verify
              </button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
}
