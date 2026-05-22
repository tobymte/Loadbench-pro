'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

/**
 * Starter Load creation form.
 *
 * UI-only validation is intentionally minimal — the canonical safety rules
 * (source required for charge-bearing saves, charge ≤ published max,
 * explicit acknowledgement) run on the server in `lib/validation/load.ts`
 * and surface as inline errors below.
 *
 * TODO(forms): replace the static <select> options with workspace-scoped
 *   Cartridge / Component / Source dropdowns loaded from the database.
 */

type Issue = { field?: string; code: string; message: string };

export function LoadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [hasCharge, setHasCharge] = useState(false);
  const [acked, setAcked] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);
    const chargeStr = (fd.get('chargeGr') as string | null)?.trim();
    const body = {
      name: fd.get('name'),
      status: fd.get('status') || 'DRAFT',
      cartridgeId: fd.get('cartridgeId'),
      bulletId: fd.get('bulletId'),
      powderId: fd.get('powderId'),
      primerId: fd.get('primerId') || null,
      caseId: fd.get('caseId') || null,
      rifleId: fd.get('rifleId') || null,
      sourceId: fd.get('sourceId') || null,
      chargeGr: chargeStr ? Number(chargeStr) : null,
      cartridgeOalIn: numberOrNull(fd.get('cartridgeOalIn')),
      cartridgeBaseToOgiveIn: numberOrNull(fd.get('cartridgeBaseToOgiveIn')),
      caseTrimLengthIn: numberOrNull(fd.get('caseTrimLengthIn')),
      neckTensionThou: numberOrNull(fd.get('neckTensionThou')),
      safetyAcknowledged: acked,
      safetyNotes: fd.get('safetyNotes') || null,
      notes: fd.get('notes') || null,
    };

    startTransition(async () => {
      const res = await fetch('/api/loads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const out = await res.json();
        router.push(`/loads/${out.id ?? ''}`);
        return;
      }
      const out = (await res.json().catch(() => ({}))) as { issues?: Issue[] };
      setIssues(out.issues ?? [{ code: 'UNKNOWN', message: 'Save failed.' }]);
    });
  }

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader title="Identification" description="Name and status of this load." />
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Name" name="name" required />
          <SelectField
            label="Status"
            name="status"
            options={['DRAFT', 'PLANNED', 'LOADED', 'TESTED', 'ARCHIVED']}
          />
          <SelectField
            label="Rifle"
            name="rifleId"
            options={[
              { value: '', label: '— None —' },
              // TODO(forms): populate with workspace rifles
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cartridge & components"
          description="Pick the cartridge and the exact components you are loading."
        />
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectField
            label="Cartridge"
            name="cartridgeId"
            required
            options={[
              { value: '', label: '— Select cartridge —' },
              // TODO(forms): workspace cartridges
            ]}
          />
          <SelectField
            label="Bullet"
            name="bulletId"
            required
            options={[
              { value: '', label: '— Select bullet —' },
              // TODO(forms): workspace BULLET components
            ]}
          />
          <SelectField
            label="Powder"
            name="powderId"
            required
            options={[
              { value: '', label: '— Select powder —' },
              // TODO(forms): workspace POWDER components
            ]}
          />
          <SelectField
            label="Primer"
            name="primerId"
            options={[
              { value: '', label: '— None —' },
              // TODO(forms): workspace PRIMER components
            ]}
          />
          <SelectField
            label="Case"
            name="caseId"
            options={[
              { value: '', label: '— None —' },
              // TODO(forms): workspace CASE components
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Charge & dimensions"
          description="Entering a charge weight requires a cited Source and your safety acknowledgement."
        />
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="chargeGr">Charge (gr)</label>
            <input
              id="chargeGr"
              name="chargeGr"
              type="number"
              step="0.05"
              min="0"
              inputMode="decimal"
              onChange={(e) => setHasCharge(Boolean(e.target.value))}
              aria-describedby="chargeGr-help"
            />
            <p id="chargeGr-help" className="text-[11px] text-text-faint mt-1">
              Leave blank to save a draft without a charge weight.
            </p>
            {issuesFor('chargeGr').map((i) => (
              <p key={i.code} className="text-[11px] text-danger mt-1">
                {i.message}
              </p>
            ))}
          </div>
          <Field label="OAL (in)" name="cartridgeOalIn" type="number" step="0.001" />
          <Field
            label="Base→ogive (in)"
            name="cartridgeBaseToOgiveIn"
            type="number"
            step="0.001"
          />
          <Field
            label="Case trim length (in)"
            name="caseTrimLengthIn"
            type="number"
            step="0.001"
          />
          <Field
            label="Neck tension (thou)"
            name="neckTensionThou"
            type="number"
            step="0.5"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Published source citation"
          description="Required for any saved charge weight. LoadBench Pro will not save a charge without a cited published reference."
        />
        <CardBody className="space-y-4">
          <SelectField
            label="Source"
            name="sourceId"
            options={[
              { value: '', label: '— None —' },
              // TODO(forms): workspace sources
            ]}
          />
          {issuesFor('sourceId').map((i) => (
            <p key={i.code} className="text-[12px] text-danger">
              {i.message}
            </p>
          ))}

          <div>
            <label htmlFor="safetyNotes">Safety notes</label>
            <textarea id="safetyNotes" name="safetyNotes" rows={3} />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
              className="!w-4 !h-4 mt-0.5"
            />
            <span className="text-xs text-text-muted leading-relaxed normal-case tracking-normal">
              I am citing a current, published reference source. I have not
              exceeded the published maximum charge for this combination. I
              understand LoadBench Pro does not validate the safety of a load
              and that I am solely responsible for what I load and shoot.
            </span>
          </label>
          {issuesFor('safety').map((i) => (
            <p key={i.code} className="text-[12px] text-danger">
              {i.message}
            </p>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notes" />
        <CardBody>
          <textarea name="notes" rows={4} />
        </CardBody>
      </Card>

      {issues.filter((i) => !i.field).map((i) => (
        <div
          key={i.code}
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
        >
          {i.message}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || (hasCharge && !acked)}>
          {pending ? 'Saving…' : 'Save load'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        {hasCharge && !acked && (
          <span className="text-[11px] text-warning">
            Acknowledgement required to save a charge weight.
          </span>
        )}
      </div>
    </form>
  );
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Field({
  label,
  name,
  required,
  type = 'text',
  step,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      <input id={name} name={name} type={type} step={step} required={required} />
    </div>
  );
}

function SelectField({
  label,
  name,
  required,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: Array<string | { value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      <select id={name} name={name} required={required} defaultValue="">
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </div>
  );
}
