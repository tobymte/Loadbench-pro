'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Issue = { field?: string; code: string; message: string };

type FormFieldProps = {
  issues: Issue[];
  field: string;
};

function FieldErrors({ issues, field }: FormFieldProps) {
  const matched = issues.filter((i) => i.field === field);
  if (matched.length === 0) return null;
  return (
    <>
      {matched.map((i) => (
        <p key={i.code} className="text-[11px] text-danger mt-1">
          {i.message}
        </p>
      ))}
    </>
  );
}

function FormErrors({ issues }: { issues: Issue[] }) {
  const formIssues = issues.filter((i) => !i.field);
  if (formIssues.length === 0) return null;
  return (
    <>
      {formIssues.map((i) => (
        <div
          key={i.code}
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
        >
          {i.message}
        </div>
      ))}
    </>
  );
}

function numberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = v.toString().trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = numberOrNull(v);
  if (n === null) return null;
  return Math.trunc(n);
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = v.toString().trim();
  return s === '' ? null : s;
}

type SubmitState = {
  pending: boolean;
  issues: Issue[];
  submit: (
    e: React.FormEvent<HTMLFormElement>,
    buildBody: (fd: FormData) => unknown,
  ) => void;
};

function useFormSubmit(endpoint: string): SubmitState {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<Issue[]>([]);

  function submit(
    event: React.FormEvent<HTMLFormElement>,
    buildBody: (fd: FormData) => unknown,
  ) {
    event.preventDefault();
    setIssues([]);
    const form = event.currentTarget;
    const fd = new FormData(form);
    const body = buildBody(fd);

    startTransition(async () => {
      const res = await fetch(endpoint, {
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
        issues?: Array<{
          path?: Array<string | number>;
          code?: string;
          message?: string;
        }>;
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
          {
            code: out.error ?? 'UNKNOWN',
            message: 'Could not save record.',
          },
        ]);
      }
    });
  }

  return { pending, issues, submit };
}

type CartridgeOpt = { id: string; name: string };
type LoadOpt = { id: string; name: string };
type ComponentOpt = { id: string; manufacturer: string; model: string };
type RifleOpt = { id: string; name: string };
type SourceOpt = { id: string; title: string };

// ---------------------------------------------------------------------------
// Case capacity
// ---------------------------------------------------------------------------

export function CaseCapacityForm({
  cartridges,
  loads,
  cases,
}: {
  cartridges: CartridgeOpt[];
  loads: LoadOpt[];
  cases: ComponentOpt[];
}) {
  const { pending, issues, submit } = useFormSubmit(
    '/api/solver-inputs/case-capacity',
  );

  return (
    <form
      onSubmit={(e) =>
        submit(e, (fd) => ({
          cartridgeId: stringOrNull(fd.get('cartridgeId')),
          loadId: stringOrNull(fd.get('loadId')),
          brassComponentId: stringOrNull(fd.get('brassComponentId')),
          lotNumber: stringOrNull(fd.get('lotNumber')),
          method: stringOrNull(fd.get('method')),
          firedOrResized: stringOrNull(fd.get('firedOrResized')),
          waterCapacityGr: numberOrNull(fd.get('waterCapacityGr')),
          sampleCount: intOrNull(fd.get('sampleCount')),
          avgCapacityGr: numberOrNull(fd.get('avgCapacityGr')),
          sdCapacityGr: numberOrNull(fd.get('sdCapacityGr')),
          tempF: numberOrNull(fd.get('tempF')),
          notes: stringOrNull(fd.get('notes')),
        }))
      }
      className="space-y-3"
      data-testid="solver-input-case-capacity-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="cc-cartridge">Cartridge</label>
          <select id="cc-cartridge" name="cartridgeId" defaultValue="">
            <option value="">— none —</option>
            {cartridges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cc-load">Load</label>
          <select id="cc-load" name="loadId" defaultValue="">
            <option value="">— none —</option>
            {loads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cc-brass">Brass / case component</label>
          <select id="cc-brass" name="brassComponentId" defaultValue="">
            <option value="">— none —</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.manufacturer} {c.model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cc-lot">Lot number</label>
          <input id="cc-lot" name="lotNumber" placeholder="e.g. ADG-23A" />
        </div>
        <div>
          <label htmlFor="cc-method">Method</label>
          <input
            id="cc-method"
            name="method"
            placeholder="water-fill / alcohol-fill"
          />
        </div>
        <div>
          <label htmlFor="cc-state">Fired / resized / new</label>
          <input id="cc-state" name="firedOrResized" placeholder="fired" />
        </div>
        <div>
          <label htmlFor="cc-water">Water capacity (gr)</label>
          <input
            id="cc-water"
            name="waterCapacityGr"
            type="number"
            step="any"
            inputMode="decimal"
          />
          <FieldErrors issues={issues} field="waterCapacityGr" />
        </div>
        <div>
          <label htmlFor="cc-samples">Sample count</label>
          <input
            id="cc-samples"
            name="sampleCount"
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
          />
        </div>
        <div>
          <label htmlFor="cc-avg">Avg capacity (gr)</label>
          <input
            id="cc-avg"
            name="avgCapacityGr"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="cc-sd">SD capacity (gr)</label>
          <input
            id="cc-sd"
            name="sdCapacityGr"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="cc-temp">Temp (°F)</label>
          <input
            id="cc-temp"
            name="tempF"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
      </div>
      <div>
        <label htmlFor="cc-notes">Notes</label>
        <textarea
          id="cc-notes"
          name="notes"
          rows={2}
          placeholder="Method details, balance, fill technique."
        />
      </div>
      <FormErrors issues={issues} />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="solver-input-case-capacity-submit"
        >
          {pending ? 'Saving…' : 'Save case capacity record'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Measurement only — no pressure computation.
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bullet dimensions
// ---------------------------------------------------------------------------

export function BulletDimensionForm({ bullets }: { bullets: ComponentOpt[] }) {
  const { pending, issues, submit } = useFormSubmit(
    '/api/solver-inputs/bullet-dimensions',
  );

  return (
    <form
      onSubmit={(e) =>
        submit(e, (fd) => ({
          componentId: stringOrNull(fd.get('componentId')),
          manufacturer: stringOrNull(fd.get('manufacturer')),
          model: stringOrNull(fd.get('model')),
          lotNumber: stringOrNull(fd.get('lotNumber')),
          weightGr: numberOrNull(fd.get('weightGr')),
          diameterIn: numberOrNull(fd.get('diameterIn')),
          lengthIn: numberOrNull(fd.get('lengthIn')),
          bearingSurfaceIn: numberOrNull(fd.get('bearingSurfaceIn')),
          boatTailLengthIn: numberOrNull(fd.get('boatTailLengthIn')),
          ogiveStyle: stringOrNull(fd.get('ogiveStyle')),
          bcG1: numberOrNull(fd.get('bcG1')),
          bcG7: numberOrNull(fd.get('bcG7')),
          sampleCount: intOrNull(fd.get('sampleCount')),
          notes: stringOrNull(fd.get('notes')),
        }))
      }
      className="space-y-3"
      data-testid="solver-input-bullet-dimensions-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="bd-comp">Bullet component</label>
          <select id="bd-comp" name="componentId" defaultValue="">
            <option value="">— none —</option>
            {bullets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.manufacturer} {c.model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bd-mfr">Manufacturer</label>
          <input id="bd-mfr" name="manufacturer" />
        </div>
        <div>
          <label htmlFor="bd-model">Model</label>
          <input id="bd-model" name="model" />
        </div>
        <div>
          <label htmlFor="bd-lot">Lot number</label>
          <input id="bd-lot" name="lotNumber" />
        </div>
        <div>
          <label htmlFor="bd-weight">Weight (gr)</label>
          <input
            id="bd-weight"
            name="weightGr"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bd-dia">Diameter (in)</label>
          <input
            id="bd-dia"
            name="diameterIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bd-len">Length (in)</label>
          <input
            id="bd-len"
            name="lengthIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bd-bs">Bearing surface (in)</label>
          <input
            id="bd-bs"
            name="bearingSurfaceIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bd-bt">Boat tail length (in)</label>
          <input
            id="bd-bt"
            name="boatTailLengthIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bd-ogive">Ogive style</label>
          <input id="bd-ogive" name="ogiveStyle" placeholder="tangent / secant" />
        </div>
        <div>
          <label htmlFor="bd-g1">BC G1</label>
          <input
            id="bd-g1"
            name="bcG1"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bd-g7">BC G7</label>
          <input
            id="bd-g7"
            name="bcG7"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bd-samples">Sample count</label>
          <input
            id="bd-samples"
            name="sampleCount"
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
          />
        </div>
      </div>
      <div>
        <label htmlFor="bd-notes">Notes</label>
        <textarea id="bd-notes" name="notes" rows={2} />
      </div>
      <FormErrors issues={issues} />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="solver-input-bullet-dimensions-submit"
        >
          {pending ? 'Saving…' : 'Save bullet dimension record'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Dimensional metadata only — no ballistics computation.
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Powder metadata
// ---------------------------------------------------------------------------

export function PowderMetadataForm({
  powders,
  sources,
}: {
  powders: ComponentOpt[];
  sources: SourceOpt[];
}) {
  const { pending, issues, submit } = useFormSubmit(
    '/api/solver-inputs/powder-metadata',
  );

  return (
    <form
      onSubmit={(e) =>
        submit(e, (fd) => ({
          componentId: stringOrNull(fd.get('componentId')),
          manufacturer: stringOrNull(fd.get('manufacturer')),
          powderName: stringOrNull(fd.get('powderName')),
          lotNumber: stringOrNull(fd.get('lotNumber')),
          burnRateLabel: stringOrNull(fd.get('burnRateLabel')),
          densityGcc: numberOrNull(fd.get('densityGcc')),
          bulkDensityGrPerCc: numberOrNull(fd.get('bulkDensityGrPerCc')),
          kernelShape: stringOrNull(fd.get('kernelShape')),
          tempSensitivityNotes: stringOrNull(fd.get('tempSensitivityNotes')),
          sourceId: stringOrNull(fd.get('sourceId')),
          notes: stringOrNull(fd.get('notes')),
        }))
      }
      className="space-y-3"
      data-testid="solver-input-powder-metadata-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="pm-comp">Powder component</label>
          <select id="pm-comp" name="componentId" defaultValue="">
            <option value="">— none —</option>
            {powders.map((c) => (
              <option key={c.id} value={c.id}>
                {c.manufacturer} {c.model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pm-mfr">Manufacturer</label>
          <input id="pm-mfr" name="manufacturer" />
        </div>
        <div>
          <label htmlFor="pm-name">Powder name</label>
          <input id="pm-name" name="powderName" placeholder="e.g. H4350" />
        </div>
        <div>
          <label htmlFor="pm-lot">Lot number</label>
          <input id="pm-lot" name="lotNumber" />
        </div>
        <div>
          <label htmlFor="pm-burn">Burn rate label</label>
          <input id="pm-burn" name="burnRateLabel" />
        </div>
        <div>
          <label htmlFor="pm-density">Density (g/cc)</label>
          <input
            id="pm-density"
            name="densityGcc"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="pm-bulk">Bulk density (gr/cc)</label>
          <input
            id="pm-bulk"
            name="bulkDensityGrPerCc"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="pm-shape">Kernel shape</label>
          <input id="pm-shape" name="kernelShape" placeholder="extruded / ball" />
        </div>
        <div>
          <label htmlFor="pm-source">Cited source</label>
          <select id="pm-source" name="sourceId" defaultValue="">
            <option value="">— none —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="pm-temp">Temp sensitivity notes</label>
        <textarea id="pm-temp" name="tempSensitivityNotes" rows={2} />
      </div>
      <div>
        <label htmlFor="pm-notes">Notes</label>
        <textarea id="pm-notes" name="notes" rows={2} />
      </div>
      <FormErrors issues={issues} />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="solver-input-powder-metadata-submit"
        >
          {pending ? 'Saving…' : 'Save powder metadata record'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Metadata only — no charge advice.
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Barrel geometry
// ---------------------------------------------------------------------------

export function BarrelGeometryForm({ rifles }: { rifles: RifleOpt[] }) {
  const { pending, issues, submit } = useFormSubmit(
    '/api/solver-inputs/barrel-geometry',
  );

  return (
    <form
      onSubmit={(e) =>
        submit(e, (fd) => ({
          rifleId: stringOrNull(fd.get('rifleId')),
          name: stringOrNull(fd.get('name')),
          barrelLengthIn: numberOrNull(fd.get('barrelLengthIn')),
          twistRate: stringOrNull(fd.get('twistRate')),
          boreDiameterIn: numberOrNull(fd.get('boreDiameterIn')),
          grooveDiameterIn: numberOrNull(fd.get('grooveDiameterIn')),
          chamberNotes: stringOrNull(fd.get('chamberNotes')),
          throatLengthIn: numberOrNull(fd.get('throatLengthIn')),
          freeboreIn: numberOrNull(fd.get('freeboreIn')),
          landCount: intOrNull(fd.get('landCount')),
          notes: stringOrNull(fd.get('notes')),
        }))
      }
      className="space-y-3"
      data-testid="solver-input-barrel-geometry-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="bg-rifle">Rifle</label>
          <select id="bg-rifle" name="rifleId" defaultValue="">
            <option value="">— none —</option>
            {rifles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bg-name">Name / label</label>
          <input id="bg-name" name="name" placeholder="e.g. Bartlein 26in" />
        </div>
        <div>
          <label htmlFor="bg-len">Barrel length (in)</label>
          <input
            id="bg-len"
            name="barrelLengthIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bg-twist">Twist rate</label>
          <input id="bg-twist" name="twistRate" placeholder="1:8" />
        </div>
        <div>
          <label htmlFor="bg-bore">Bore diameter (in)</label>
          <input
            id="bg-bore"
            name="boreDiameterIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bg-groove">Groove diameter (in)</label>
          <input
            id="bg-groove"
            name="grooveDiameterIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bg-throat">Throat length (in)</label>
          <input
            id="bg-throat"
            name="throatLengthIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bg-freebore">Freebore (in)</label>
          <input
            id="bg-freebore"
            name="freeboreIn"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="bg-lands">Land count</label>
          <input
            id="bg-lands"
            name="landCount"
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
          />
        </div>
      </div>
      <div>
        <label htmlFor="bg-chamber">Chamber notes</label>
        <textarea id="bg-chamber" name="chamberNotes" rows={2} />
      </div>
      <div>
        <label htmlFor="bg-notes">Notes</label>
        <textarea id="bg-notes" name="notes" rows={2} />
      </div>
      <FormErrors issues={issues} />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="solver-input-barrel-geometry-submit"
        >
          {pending ? 'Saving…' : 'Save barrel geometry record'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Geometry metadata only.
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Chrono calibration
// ---------------------------------------------------------------------------

export function ChronoCalibrationForm({ loads }: { loads: LoadOpt[] }) {
  const { pending, issues, submit } = useFormSubmit(
    '/api/solver-inputs/chrono-calibration',
  );

  return (
    <form
      onSubmit={(e) =>
        submit(e, (fd) => ({
          deviceName: stringOrNull(fd.get('deviceName')),
          deviceType: stringOrNull(fd.get('deviceType')),
          serialNumber: stringOrNull(fd.get('serialNumber')),
          firmwareVersion: stringOrNull(fd.get('firmwareVersion')),
          calibrationDate: stringOrNull(fd.get('calibrationDate')),
          referenceLoadId: stringOrNull(fd.get('referenceLoadId')),
          referenceVelocityFps: numberOrNull(fd.get('referenceVelocityFps')),
          observedVelocityFps: numberOrNull(fd.get('observedVelocityFps')),
          offsetFps: numberOrNull(fd.get('offsetFps')),
          conditionsJson: stringOrNull(fd.get('conditionsJson')),
          notes: stringOrNull(fd.get('notes')),
        }))
      }
      className="space-y-3"
      data-testid="solver-input-chrono-calibration-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor="cal-name">Device name</label>
          <input id="cal-name" name="deviceName" />
        </div>
        <div>
          <label htmlFor="cal-type">Device type</label>
          <input id="cal-type" name="deviceType" placeholder="LabRadar / Garmin / MagnetoSpeed" />
        </div>
        <div>
          <label htmlFor="cal-serial">Serial number</label>
          <input id="cal-serial" name="serialNumber" />
        </div>
        <div>
          <label htmlFor="cal-fw">Firmware version</label>
          <input id="cal-fw" name="firmwareVersion" />
        </div>
        <div>
          <label htmlFor="cal-date">Calibration date</label>
          <input id="cal-date" name="calibrationDate" type="date" />
          <FieldErrors issues={issues} field="calibrationDate" />
        </div>
        <div>
          <label htmlFor="cal-ref-load">Reference load</label>
          <select id="cal-ref-load" name="referenceLoadId" defaultValue="">
            <option value="">— none —</option>
            {loads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cal-ref-vel">Reference velocity (fps)</label>
          <input
            id="cal-ref-vel"
            name="referenceVelocityFps"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="cal-obs-vel">Observed velocity (fps)</label>
          <input
            id="cal-obs-vel"
            name="observedVelocityFps"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
        <div>
          <label htmlFor="cal-offset">Offset (fps)</label>
          <input
            id="cal-offset"
            name="offsetFps"
            type="number"
            step="any"
            inputMode="decimal"
          />
        </div>
      </div>
      <div>
        <label htmlFor="cal-cond">Conditions (JSON)</label>
        <textarea
          id="cal-cond"
          name="conditionsJson"
          rows={2}
          placeholder='{"tempF":60,"humidityPct":35,"pressureInHg":29.92}'
        />
      </div>
      <div>
        <label htmlFor="cal-notes">Notes</label>
        <textarea id="cal-notes" name="notes" rows={2} />
      </div>
      <FormErrors issues={issues} />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          data-testid="solver-input-chrono-calibration-submit"
        >
          {pending ? 'Saving…' : 'Save chrono calibration record'}
        </Button>
        <span className="text-[11px] text-text-faint">
          Device calibration log only.
        </span>
      </div>
    </form>
  );
}
