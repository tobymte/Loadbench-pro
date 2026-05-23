/**
 * Validation for the non-operational simulation sandbox.
 *
 * SAFETY:
 *   - This module performs NO pressure math.
 *   - It computes NO charge recommendations.
 *   - It makes NO safe/unsafe claim about any load.
 *   - Inputs are explicitly rejected if they include forbidden keys that
 *     would imply a predicted pressure or load advice.
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
