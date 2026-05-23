// Client for the LoadBench Pro Ballistics Engine (.NET service).
//
// Scope: EXTERNAL / downrange ballistics ONLY. This client never asks the
// engine for chamber pressure, PSI, charge-weight advice, "safe / unsafe"
// verdicts, or powder substitutions, and any extra fields returned by the
// engine that fall outside the external-ballistics whitelist are dropped
// before the result is returned to the caller.

import { z } from 'zod';

export const ballisticsRequestSchema = z.object({
  muzzleVelocityFps: z.number().finite().positive().max(6000),
  bulletWeightGr: z.number().finite().positive().max(1000),
  bcG1: z.number().finite().positive().max(2),
  zeroDistanceYd: z.number().finite().positive().max(2000),
  sightHeightIn: z.number().finite().min(0).max(12),
  maxRangeYd: z.number().finite().positive().max(3000),
  intervalYd: z.number().finite().positive().max(500),
  tempF: z.number().finite().min(-80).max(160).nullable().optional(),
  altitudeFt: z.number().finite().min(-1000).max(30000).nullable().optional(),
  windMph: z.number().finite().min(0).max(120).nullable().optional(),
  windAngleDeg: z.number().finite().min(0).max(360).nullable().optional(),
}).refine(
  (v) => v.maxRangeYd / v.intervalYd <= 200,
  { message: 'Too many trajectory rows requested. Increase the interval or reduce max range.' },
);

export type BallisticsRequest = z.infer<typeof ballisticsRequestSchema>;

export type TrajectoryPoint = {
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

export type BallisticsResult = {
  engine: string;
  engineNotice: string;
  scopeNotice: string;
  points: TrajectoryPoint[];
};

export type BallisticsClientError =
  | { kind: 'unconfigured' }
  | { kind: 'invalid_request'; problems: string[] }
  | { kind: 'engine_error'; status: number; message: string }
  | { kind: 'network_error'; message: string };

const POINT_KEYS = [
  'rangeYd',
  'velocityFps',
  'energyFtLb',
  'dropIn',
  'driftIn',
  'timeSec',
  'moa',
  'mil',
  'windMoa',
  'windMil',
] as const;

function sanitizePoint(p: unknown): TrajectoryPoint | null {
  if (!p || typeof p !== 'object') return null;
  const out: Record<string, number> = {};
  for (const k of POINT_KEYS) {
    const v = (p as Record<string, unknown>)[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    out[k] = v;
  }
  return out as unknown as TrajectoryPoint;
}

export function getEngineUrl(): string | null {
  const raw = process.env.BALLISTICS_ENGINE_URL;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : null;
}

export async function callBallisticsEngine(
  req: BallisticsRequest,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<{ ok: true; data: BallisticsResult } | { ok: false; error: BallisticsClientError }> {
  const base = getEngineUrl();
  if (!base) {
    return { ok: false, error: { kind: 'unconfigured' } };
  }

  const url = `${base}/v1/trajectory`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1000, opts.timeoutMs ?? 8000),
  );
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      let message = `engine returned ${res.status}`;
      try {
        const body = await res.json();
        if (body && typeof body === 'object' && 'problems' in body) {
          const problems = (body as { problems?: unknown }).problems;
          if (Array.isArray(problems)) {
            return {
              ok: false,
              error: { kind: 'invalid_request', problems: problems.map(String) },
            };
          }
        }
        if (body && typeof (body as { error?: unknown }).error === 'string') {
          message = (body as { error: string }).error;
        }
      } catch {
        // ignore — fall through with default message
      }
      return { ok: false, error: { kind: 'engine_error', status: res.status, message } };
    }

    const raw = (await res.json()) as Record<string, unknown>;
    const points = Array.isArray(raw.points) ? raw.points : [];
    const sanitized: TrajectoryPoint[] = [];
    for (const p of points) {
      const cleaned = sanitizePoint(p);
      if (cleaned) sanitized.push(cleaned);
    }

    return {
      ok: true,
      data: {
        engine: typeof raw.engine === 'string' ? raw.engine : 'unknown',
        engineNotice: typeof raw.engineNotice === 'string' ? raw.engineNotice : '',
        scopeNotice:
          typeof raw.scopeNotice === 'string'
            ? raw.scopeNotice
            : 'External/downrange only. No chamber pressure, no PSI, no load safety verdict.',
        points: sanitized,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'request to ballistics engine failed';
    return { ok: false, error: { kind: 'network_error', message } };
  } finally {
    clearTimeout(timeout);
  }
}
