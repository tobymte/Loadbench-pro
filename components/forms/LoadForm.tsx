'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

type Issue = { field?: string; code: string; message: string };

export type LoadFormOption = { value: string; label: string };

export type LoadFormOptions = {
  cartridges: LoadFormOption[];
  bullets: LoadFormOption[];
  powders: LoadFormOption[];
  primers: LoadFormOption[];
  cases: LoadFormOption[];
  rifles: LoadFormOption[];
  sources: LoadFormOption[];
};

export function LoadForm({ options }: { options: LoadFormOptions }) {
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
      name: ((fd.get('name') as string | null) ?? '').trim(),
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
      safetyNotes: stringOrNull(fd.get('safetyNotes')),
      notes: stringOrNull(fd.get('notes')),
    };

    startTransition(async () => {
      const res = await fetch('/api/loads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const out = await res.json();
        if (out?.id) {
          router.push(`/loads/${out.id}`);
        } else {
          router.push('/loads');
        }
        router.refresh();
        return;
      }
      const out = (await res.json().catch(() => ({}))) as {
        issues?: Array<{
          field?: string;
          path?: Array<string | number>;
          code?: string;
          message?: string;
        }>;
      };
      const mapped: Issue[] = (out.issues ?? []).map((i) => ({
        field: i.field ?? i.path?.[0]?.toString(),
        code: i.code ?? 'INVALID',
        message: i.message ?? 'Invalid value.',
      }));
      setIssues(
        mapped.length > 0
          ? mapped
          : [{ code: 'UNKNOWN', message: 'Save failed.' }],
      );
    });
  }

  const issuesFor = (field: string) => issues.filter((i) => i.field === field);
  const formIssues = issues.filter((i) => !i.field);

  return (
    <form onSubmit={onSubmit} className="space-y-6" data-testid="load-form">
      <Card>
        <CardHeader title="Identification" description="Name and status of this load." />
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Name" name="name" required testId="load-name" issues={issuesFor('name')} />
          <SelectField
            label="Status"
            name="status"
            options={['DRAFT', 'PLANNED', 'LOADED', 'TESTED', 'ARCHIVED']}
          />
          <SelectField
            label="Rifle"
            name="rifleId"
            options={[{ value: '', label: '— None —' }, ...options.rifles]}
            issues={issuesFor('rifleId')}
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
            testId="load-cartridge"
            options={[{ value: '', label: '— Select cartridge —' }, ...options.cartridges]}
            issues={issuesFor('cartridgeId')}
          />
          <SelectField
            label="Bullet"
            name="bulletId"
            required
            testId="load-bullet"
            options={[{ value: '', label: '— Select bullet —' }, ...options.bullets]}
            issues={issuesFor('bulletId')}
          />
          <SelectField
            label="Powder"
            name="powderId"
            required
            testId="load-powder"
            options={[{ value: '', label: '— Select powder —' }, ...options.powders]}
            issues={issuesFor('powderId')}
          />
          <SelectField
            label="Primer"
            name="primerId"
            options={[{ value: '', label: '— None —' }, ...options.primers]}
            issues={issuesFor('primerId')}
          />
          <SelectField
            label="Case"
            name="caseId"
            options={[{ value: '', label: '— None —' }, ...options.cases]}
            issues={issuesFor('caseId')}
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
              data-testid="load-charge"
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
          <Field label="OAL (in)" name="cartridgeOalIn" type="number" step="0.001" issues={issuesFor('cartridgeOalIn')} />
          <Field
            label="Base→ogive (in)"
            name="cartridgeBaseToOgiveIn"
            type="number"
            step="0.001"
            issues={issuesFor('cartridgeBaseToOgiveIn')}
          />
          <Field
            label="Case trim length (in)"
            name="caseTrimLengthIn"
            type="number"
            step="0.001"
            issues={issuesFor('caseTrimLengthIn')}
          />
          <Field
            label="Neck tension (thou)"
            name="neckTensionThou"
            type="number"
            step="0.5"
            issues={issuesFor('neckTensionThou')}
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
            testId="load-source"
            options={[{ value: '', label: '— None —' }, ...options.sources]}
            issues={issuesFor('sourceId')}
          />

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
              data-testid="load-ack"
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

      {formIssues.map((i) => (
        <div
          key={i.code}
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
        >
          {i.message}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || (hasCharge && !acked)} data-testid="load-submit">
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
  if (v === null) return null;
  const s = v.toString().trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = v.toString().trim();
  return s === '' ? null : s;
}

function Field({
  label,
  name,
  required,
  type = 'text',
  step,
  testId,
  issues,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  step?: string;
  testId?: string;
  issues?: Issue[];
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      <input id={name} name={name} type={type} step={step} required={required} data-testid={testId} />
      {issues?.map((i) => (
        <p key={i.code} className="text-[11px] text-danger mt-1">
          {i.message}
        </p>
      ))}
    </div>
  );
}

function SelectField({
  label,
  name,
  required,
  options,
  testId,
  issues,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: Array<string | { value: string; label: string }>;
  testId?: string;
  issues?: Issue[];
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      <select id={name} name={name} required={required} defaultValue="" data-testid={testId}>
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value || '__empty__'} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
      {issues?.map((i) => (
        <p key={i.code} className="text-[11px] text-danger mt-1">
          {i.message}
        </p>
      ))}
    </div>
  );
}
