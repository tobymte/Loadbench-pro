/**
 * Validation for the non-operational simulation sandbox.
 *
 * SAFETY:
 *   - This module performs NO pressure math.
 *   - It computes NO charge recommendations.
 *   - It makes NO safe/unsafe claim about any load.
 *   - Inputs are explicitly rejected if they include forbidden keys that
 *     would imply a predicted pressure or load advice.
 *   - All computed metrics are descriptive comparisons of user-entered
 *     velocity values (delta, percent delta, abs delta, residual against the
 *     reference, range-session ES/SD echoed for display, data completeness,
 *     coverage label). None of these are predictions.
 */

import { z } from 'zod';

export const SIMULATION_RUN_STATUSES = [
  'DRAFT',
  'INPUT_INCOMPLETE',
  'READY_FOR_EXPERT_REVIEW',
  'REFERENCE_MATCHED_WITHIN_TOLERANCE',
  'NEEDS_INVESTIGATION',
  'REJECTED_BY_REVIEWER',
] as const;

export const simulationRunStatusSchema = z.enum(SIMULATION_RUN_STATUSES);

export type SimulationRunStatus = (typeof SIMULATION_RUN_STATUSES)[number];

export const SIMULATION_STATUS_LABEL: Record<SimulationRunStatus, string> = {
  DRAFT: 'Draft',
  INPUT_INCOMPLETE: 'Input incomplete',
  READY_FOR_EXPERT_REVIEW: 'Ready for expert review',
  REFERENCE_MATCHED_WITHIN_TOLERANCE: 'Reference matched within tolerance',
  NEEDS_INVESTIGATION: 'Needs investigation',
  REJECTED_BY_REVIEWER: 'Rejected by reviewer',
};

/**
 * Keys the sandbox refuses to accept. Any of these would imply the app is
 * making a pressure prediction or load recommendation, which it explicitly
 * does not do. We reject the entire request rather than silently dropping
 * the field, so callers can't be quietly successful with a forbidden body.
 */
export const FORBIDDEN_SIMULATION_KEYS = [
  'predictedPressurePsi',
  'predictedPressure',
  'pressurePrediction',
  'recommendedChargeGr',
  'recommendedCharge',
  'chargeRecommendation',
  'loadAdvice',
  'safeCharge',
  'safe',
  'unsafe',
  'isSafe',
  'safetyVerdict',
] as const;

export const FORBIDDEN_KEYS_MESSAGE =
  'This sandbox does not accept pressure predictions, charge recommendations, or safe/unsafe claims. Remove forbidden fields.';

export const ACKNOWLEDGEMENT_REQUIRED_MESSAGE =
  'You must confirm: "I understand this sandbox does not calculate pressure or recommend loads."';

export const simulationRunInputSchema = z.object({
  modelVersionId: z.string().min(1, 'Model version is required'),
  loadId: z.string().optional().nullable(),
  validationRecordId: z.string().optional().nullable(),
  rangeSessionId: z.string().optional().nullable(),
  publishedRowId: z.string().optional().nullable(),
  status: simulationRunStatusSchema.default('DRAFT'),
  toleranceFps: z.number().min(0).max(10_000).optional().nullable(),
  tolerancePct: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  reviewerNotes: z.string().max(4000).optional().nullable(),
  acknowledgedExperimental: z.boolean(),
});

export type SimulationRunInput = z.infer<typeof simulationRunInputSchema>;

/**
 * Pure helper to compute velocity-delta bookkeeping from two user-entered
 * fps values. Returns nulls when inputs are missing. Velocity-only; this
 * does not compute pressure.
 */
export function computeVelocityDelta(
  referenceFps: number | null | undefined,
  observedFps: number | null | undefined,
): { deltaFps: number | null; deltaPct: number | null } {
  if (
    referenceFps == null ||
    observedFps == null ||
    !Number.isFinite(referenceFps) ||
    !Number.isFinite(observedFps)
  ) {
    return { deltaFps: null, deltaPct: null };
  }
  const deltaFps = observedFps - referenceFps;
  const deltaPct = referenceFps === 0 ? null : (deltaFps / referenceFps) * 100;
  return { deltaFps, deltaPct };
}

export function hasForbiddenKeys(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const keys = Object.keys(body as Record<string, unknown>);
  return keys.filter((k) =>
    (FORBIDDEN_SIMULATION_KEYS as readonly string[]).includes(k),
  );
}

/**
 * Coverage / data-completeness label for the velocity comparison. Strictly
 * a UI hint describing how complete the inputs were — it does not change
 * the stored numbers and does not certify anything as safe.
 */
export type SimulationCoverageLabel =
  | 'no-data'
  | 'reference-only'
  | 'observed-only'
  | 'velocity-comparison-complete';

export function deriveCoverageLabel(
  referenceFps: number | null | undefined,
  observedFps: number | null | undefined,
): SimulationCoverageLabel {
  const hasRef = referenceFps != null && Number.isFinite(referenceFps);
  const hasObs = observedFps != null && Number.isFinite(observedFps);
  if (hasRef && hasObs) return 'velocity-comparison-complete';
  if (hasRef) return 'reference-only';
  if (hasObs) return 'observed-only';
  return 'no-data';
}

export const COVERAGE_LABEL_DESCRIPTION: Record<SimulationCoverageLabel, string> = {
  'no-data': 'No reference or observed velocity supplied.',
  'reference-only': 'Reference velocity supplied; no observed value to compare.',
  'observed-only': 'Observed velocity supplied; no reference value to compare against.',
  'velocity-comparison-complete':
    'Both reference and observed velocity supplied; velocity-only delta available.',
};

/**
 * Inputs snapshot stored alongside a SimulationRun. Captures the user-entered
 * scalars and the resolved label of each linked entity at the moment the run
 * was created, so the historical record stays interpretable even if entities
 * are later renamed or unlinked.
 */
export type SimulationInputsSnapshot = {
  modelVersion: { id: string; name: string; status: string } | null;
  load: { id: string; name: string } | null;
  validationRecord: {
    id: string;
    referenceLabel: string;
    referenceVelocityFps: number | null;
    measuredVelocityFps: number | null;
    referencePressurePsi: number | null;
  } | null;
  rangeSession: {
    id: string;
    date: string;
    avgVelocityFps: number | null;
    esFps: number | null;
    sdFps: number | null;
    shotsFired: number | null;
  } | null;
  publishedRow: {
    id: string;
    bulletName: string | null;
    powderName: string | null;
    chargeGr: number | null;
    velocityFps: number | null;
    pageLabel: string | null;
    status: string;
  } | null;
  toleranceFps: number | null;
  tolerancePct: number | null;
  // What the comparison ultimately used (after resolving across the linked
  // entities) — purely descriptive bookkeeping.
  referenceFps: number | null;
  referenceSource: 'validation-record' | 'published-row' | 'none';
  observedFps: number | null;
  observedSource: 'range-session' | 'validation-record-measured' | 'none';
};

/**
 * Computed comparison metrics. Velocity-only. No pressure prediction. Every
 * field here is derived from values the user already entered elsewhere; this
 * function does no extrapolation.
 */
export type SimulationMetrics = {
  referenceFps: number | null;
  observedFps: number | null;
  deltaFps: number | null;
  deltaPct: number | null;
  absDeltaFps: number | null;
  absDeltaPct: number | null;
  residualFps: number | null;
  withinToleranceFps: boolean | null;
  withinTolerancePct: boolean | null;
  withinToleranceCombined: boolean | null;
  rangeSessionEsFps: number | null;
  rangeSessionSdFps: number | null;
  rangeSessionShots: number | null;
  coverage: SimulationCoverageLabel;
  // 0..1, what fraction of the comparison's optional bookkeeping fields the
  // user populated (reference velocity, observed velocity, tolerance, linked
  // entity for context).
  completeness: number;
};

export function computeSimulationMetrics(args: {
  referenceFps: number | null;
  observedFps: number | null;
  toleranceFps: number | null;
  tolerancePct: number | null;
  rangeSession?: {
    esFps: number | null;
    sdFps: number | null;
    shotsFired: number | null;
  } | null;
  hasLinkedEntity: boolean;
}): SimulationMetrics {
  const { referenceFps, observedFps, toleranceFps, tolerancePct, rangeSession } =
    args;
  const { deltaFps, deltaPct } = computeVelocityDelta(referenceFps, observedFps);
  const absDeltaFps = deltaFps == null ? null : Math.abs(deltaFps);
  const absDeltaPct = deltaPct == null ? null : Math.abs(deltaPct);

  let withinFps: boolean | null = null;
  if (absDeltaFps != null && toleranceFps != null) {
    withinFps = absDeltaFps <= toleranceFps;
  }
  let withinPct: boolean | null = null;
  if (absDeltaPct != null && tolerancePct != null) {
    withinPct = absDeltaPct <= tolerancePct;
  }
  let withinCombined: boolean | null = null;
  if (withinFps == null && withinPct == null) {
    withinCombined = null;
  } else {
    withinCombined = (withinFps ?? true) && (withinPct ?? true);
  }

  // "Residual" here is the same value as deltaFps. It's surfaced separately
  // so future review tooling can express it as the residual of the chosen
  // reference vs the observed value without re-coupling to velocityDeltaFps.
  const residualFps = deltaFps;

  const checks = [
    referenceFps != null,
    observedFps != null,
    toleranceFps != null || tolerancePct != null,
    args.hasLinkedEntity,
  ];
  const completeness =
    checks.filter(Boolean).length / checks.length;

  return {
    referenceFps: referenceFps ?? null,
    observedFps: observedFps ?? null,
    deltaFps,
    deltaPct,
    absDeltaFps,
    absDeltaPct,
    residualFps,
    withinToleranceFps: withinFps,
    withinTolerancePct: withinPct,
    withinToleranceCombined: withinCombined,
    rangeSessionEsFps: rangeSession?.esFps ?? null,
    rangeSessionSdFps: rangeSession?.sdFps ?? null,
    rangeSessionShots: rangeSession?.shotsFired ?? null,
    coverage: deriveCoverageLabel(referenceFps, observedFps),
    completeness,
  };
}

/**
 * Safely parse a metrics or inputs JSON blob stored on a SimulationRun.
 * Returns null when the blob is missing or unparseable. Never throws.
 */
export function parseSimulationJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
