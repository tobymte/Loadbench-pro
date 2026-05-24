'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { BallisticsCharts } from './BallisticsCharts';

type Prefill = {
  id: string;
  label: string;
  bulletWeightGr: number | null;
  bcG1: number | null;
  muzzleVelocityFps: number | null;
  zeroDistanceYd: number | null;
};

type TrajectoryPoint = {
  rangeYd: number;
  velocityFps: number;
  energyFtLb: number;
  dropIn: number;
  driftIn: number;
  timeSec: number;
  moa: number;
  mil: number;
  windMoa: number;
  windMil: number;
};

type EngineResult = {
  engine: string;
  engineNotice: string;
  scopeNotice: string;
  points: TrajectoryPoint[];
};

const DEFAULTS = {
  muzzleVelocityFps: '2800',
  bulletWeightGr: '140',
  bcG1: '0.535',
  zeroDistanceYd: '100',
  sightHeightIn: '1.5',
  maxRangeYd: '1000',
  intervalYd: '50',
  tempF: '59',
  altitudeFt: '0',
  windMph: '0',
  windAngleDeg: '90',
};

export function BallisticsCalculator({
  prefills,
  engineConfigured,
}: {
  prefills: Prefill[];
  engineConfigured: boolean;
}) {
  const [loadId, setLoadId] = useState('');
  const [fields, setFields] = useState({ ...DEFAULTS });
  const [result, setResult] = useState<EngineResult | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(name: keyof typeof DEFAULTS, value: string) {
    setFields((f) => ({ ...f, [name]: value }));
  }

  function applyPrefill(id: string) {
    setLoadId(id);
    const p = prefills.find((x) => x.id === id);
    if (!p) return;
    setFields((f) => ({
      ...f,
      muzzleVelocityFps:
        p.muzzleVelocityFps != null
          ? String(p.muzzleVelocityFps)
          : f.muzzleVelocityFps,
      bulletWeightGr:
        p.bulletWeightGr != null ? String(p.bulletWeightGr) : f.bulletWeightGr,
      bcG1: p.bcG1 != null ? String(p.bcG1) : f.bcG1,
      zeroDistanceYd:
        p.zeroDistanceYd != null
          ? String(p.zeroDistanceYd)
          : f.zeroDistanceYd,
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWarning(null);
    setError(null);

    const payload = {
      muzzleVelocityFps: Number(fields.muzzleVelocityFps),
      bulletWeightGr: Number(fields.bulletWeightGr),
      bcG1: Number(fields.bcG1),
      zeroDistanceYd: Number(fields.zeroDistanceYd),
      sightHeightIn: Number(fields.sightHeightIn),
      maxRangeYd: Number(fields.maxRangeYd),
      intervalYd: Number(fields.intervalYd),
      tempF: numberOrNull(fields.tempF),
      altitudeFt: numberOrNull(fields.altitudeFt),
      windMph: numberOrNull(fields.windMph),
      windAngleDeg: numberOrNull(fields.windAngleDeg),
    };

    const problems: string[] = [];
    if (!(payload.muzzleVelocityFps > 0))
      problems.push('Muzzle velocity must be > 0.');
    if (!(payload.bulletWeightGr > 0))
      problems.push('Bullet weight must be > 0.');
    if (!(payload.bcG1 > 0)) problems.push('Ballistic coefficient must be > 0.');
    if (!(payload.zeroDistanceYd > 0))
      problems.push('Zero distance must be > 0.');
    if (!(payload.maxRangeYd > 0)) problems.push('Max range must be > 0.');
    if (!(payload.intervalYd > 0)) problems.push('Interval must be > 0.');
    if (payload.maxRangeYd / payload.intervalYd > 200)
      problems.push(
        'Too many trajectory rows requested. Increase the interval or reduce max range.',
      );

    if (problems.length > 0) {
      setWarning(problems.join(' '));
      setResult(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/ballistics/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as {
        data?: EngineResult;
        error?: string;
        message?: string;
        problems?: string[];
      };

      if (!res.ok || !body.data) {
        if (res.status === 503) {
          setError(
            body.message ??
              'The ballistics engine is not configured. Set BALLISTICS_ENGINE_URL and start the .NET service (services/ballistics-engine).',
          );
        } else if (res.status === 504) {
          setError(
            body.message ??
              'The ballistics engine is unreachable. Confirm the .NET service is running and that BALLISTICS_ENGINE_URL points to it.',
          );
        } else if (res.status === 502) {
          setError(
            body.message ??
              'The ballistics engine returned an error. Check the .NET service logs.',
          );
        } else if (body.problems && body.problems.length > 0) {
          setWarning(body.problems.join(' '));
        } else {
          setError(body.message ?? body.error ?? `Request failed (${res.status}).`);
        }
        setResult(null);
        return;
      }

      setResult(body.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Network error calling ballistics engine: ${err.message}`
          : 'Network error calling ballistics engine.',
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const showWind = useMemo(() => {
    const w = Number(fields.windMph);
    return Number.isFinite(w) && w > 0;
  }, [fields.windMph]);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
      data-testid="ballistics-form"
    >
      {prefills.length > 0 && (
        <div className="rounded-md border border-border bg-bg-alt/40 px-4 py-3">
          <label htmlFor="ballistics-prefill">
            Prefill from a load (optional)
          </label>
          <select
            id="ballistics-prefill"
            value={loadId}
            onChange={(e) => applyPrefill(e.target.value)}
            data-testid="ballistics-prefill"
          >
            <option value="">— Manual entry —</option>
            {prefills.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-text-faint">
            Prefills only fill what your load has on file (bullet weight, BC,
            latest observed avg velocity, rifle zero). Override any value
            below before computing.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <NumberField
          label="Muzzle velocity (fps)"
          name="muzzleVelocityFps"
          value={fields.muzzleVelocityFps}
          onChange={(v) => update('muzzleVelocityFps', v)}
          step="1"
          required
          testId="ballistics-mv"
        />
        <NumberField
          label="Bullet weight (gr)"
          name="bulletWeightGr"
          value={fields.bulletWeightGr}
          onChange={(v) => update('bulletWeightGr', v)}
          step="0.1"
          required
          testId="ballistics-weight"
        />
        <NumberField
          label="BC G1 (approx.)"
          name="bcG1"
          value={fields.bcG1}
          onChange={(v) => update('bcG1', v)}
          step="0.001"
          required
          testId="ballistics-bc"
        />
        <NumberField
          label="Zero distance (yd)"
          name="zeroDistanceYd"
          value={fields.zeroDistanceYd}
          onChange={(v) => update('zeroDistanceYd', v)}
          step="1"
          required
          testId="ballistics-zero"
        />
        <NumberField
          label="Sight height (in)"
          name="sightHeightIn"
          value={fields.sightHeightIn}
          onChange={(v) => update('sightHeightIn', v)}
          step="0.01"
          required
          testId="ballistics-sight"
        />
        <NumberField
          label="Max range (yd)"
          name="maxRangeYd"
          value={fields.maxRangeYd}
          onChange={(v) => update('maxRangeYd', v)}
          step="50"
          required
          testId="ballistics-range"
        />
        <NumberField
          label="Interval (yd)"
          name="intervalYd"
          value={fields.intervalYd}
          onChange={(v) => update('intervalYd', v)}
          step="25"
          required
          testId="ballistics-interval"
        />
        <NumberField
          label="Temp (°F)"
          name="tempF"
          value={fields.tempF}
          onChange={(v) => update('tempF', v)}
          step="1"
          testId="ballistics-temp"
        />
        <NumberField
          label="Altitude (ft)"
          name="altitudeFt"
          value={fields.altitudeFt}
          onChange={(v) => update('altitudeFt', v)}
          step="100"
          testId="ballistics-alt"
        />
        <NumberField
          label="Wind (mph)"
          name="windMph"
          value={fields.windMph}
          onChange={(v) => update('windMph', v)}
          step="0.5"
          testId="ballistics-wind"
        />
        <NumberField
          label="Wind angle (°, 90 = full cross)"
          name="windAngleDeg"
          value={fields.windAngleDeg}
          onChange={(v) => update('windAngleDeg', v)}
          step="5"
          testId="ballistics-wind-angle"
        />
      </div>

      {warning && (
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-2 text-[12px] text-warning"
          data-testid="ballistics-warning"
        >
          {warning}
        </div>
      )}

      {error && (
        <div
          className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger"
          data-testid="ballistics-error"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          data-testid="ballistics-compute"
          disabled={loading || !engineConfigured}
        >
          {loading ? 'Computing…' : 'Compute trajectory'}
        </Button>
        <span className="text-[11px] text-text-faint">
          External-flight estimate from the ballistics engine. Verify against
          actual chronograph and target data.
        </span>
      </div>

      {result && result.points.length > 0 && (
        <div className="space-y-3">
          {(result.engine === 'placeholder' || result.engineNotice) && (
            <div
              className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-[11px] text-warning"
              data-testid="ballistics-engine-notice"
            >
              <strong>Engine:</strong> {result.engine}
              {result.engineNotice ? ` — ${result.engineNotice}` : ''}
            </div>
          )}

          <SummaryCards points={result.points} showWind={showWind} />

          <BallisticsCharts points={result.points} showWind={showWind} />

          <div className="overflow-x-auto">
            <table data-testid="ballistics-table">
              <thead>
                <tr>
                  <th className="text-right">Range (yd)</th>
                  <th className="text-right">Velocity (fps)</th>
                  <th className="text-right">Energy (ft·lb)</th>
                  <th className="text-right">Drop (in)</th>
                  <th className="text-right">MOA</th>
                  <th className="text-right">Mil</th>
                  <th className="text-right">ToF (s)</th>
                  {showWind && (
                    <>
                      <th className="text-right">Drift (in)</th>
                      <th className="text-right">Wind MOA</th>
                      <th className="text-right">Wind Mil</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {result.points.map((p) => (
                  <tr key={p.rangeYd}>
                    <td className="text-right tabular-nums">{p.rangeYd}</td>
                    <td className="text-right tabular-nums">{p.velocityFps}</td>
                    <td className="text-right tabular-nums">{p.energyFtLb}</td>
                    <td className="text-right tabular-nums">{p.dropIn}</td>
                    <td className="text-right tabular-nums">{p.moa}</td>
                    <td className="text-right tabular-nums">{p.mil}</td>
                    <td className="text-right tabular-nums">{p.timeSec}</td>
                    {showWind && (
                      <>
                        <td className="text-right tabular-nums">{p.driftIn}</td>
                        <td className="text-right tabular-nums">{p.windMoa}</td>
                        <td className="text-right tabular-nums">{p.windMil}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-text-faint">
              {result.scopeNotice ||
                'External / downrange ballistics only. No chamber pressure, no PSI, no load safety verdict, no charge recommendations.'}
            </p>
          </div>
        </div>
      )}
    </form>
  );
}

function SummaryCards({
  points,
  showWind,
}: {
  points: TrajectoryPoint[];
  showWind: boolean;
}) {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const muzzle = points[0];
  const items: Array<{ label: string; value: string }> = [
    { label: 'Max range', value: `${last.rangeYd} yd` },
    { label: 'Velocity at max', value: `${last.velocityFps} fps` },
    { label: 'Energy at max', value: `${last.energyFtLb} ft·lb` },
    { label: 'Drop at max', value: `${last.dropIn} in` },
    { label: 'Time of flight', value: `${last.timeSec} s` },
    { label: 'Muzzle velocity', value: `${muzzle.velocityFps} fps` },
  ];
  if (showWind) {
    items.push({ label: 'Drift at max', value: `${last.driftIn} in` });
  }
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
      data-testid="ballistics-summary"
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-md border border-border bg-bg-alt/30 px-3 py-2"
        >
          <div className="text-[11px] text-text-faint">{it.label}</div>
          <div className="text-[14px] font-medium tabular-nums">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function NumberField({
  label,
  name,
  value,
  onChange,
  step,
  required,
  testId,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  required?: boolean;
  testId?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        required={required}
        data-testid={testId}
      />
    </div>
  );
}

function numberOrNull(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
