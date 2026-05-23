/**
 * Pressure engine — non-operational shell.
 *
 * SAFETY (hard constraints, enforced by guardrails below and by the API
 * route that imports them):
 *
 *   1. The engine performs NO pressure math.
 *   2. The engine produces NO predicted PSI, peak PSI, or chamber pressure.
 *   3. The engine produces NO charge recommendation, max-charge advice,
 *      "safe" / "unsafe" verdict, increase/decrease charge advice, or
 *      powder substitution.
 *   4. Any input body that contains one of the FORBIDDEN_OUTPUT_KEYS below
 *      is REJECTED outright. Any output object the engine assembles is
 *      additionally stripped of those keys before persistence and before
 *      it leaves the server boundary.
 *   5. Every persisted run row carries `pressurePredictionStatus =
 *      'disabled'`, persisted in a dedicated column, so historical audit
 *      can prove no run produced a pressure estimate.
 *
 * What the runner DOES emit:
 *   - dataCompleteness   — 0..1 score of how many required solver-input
 *                          / chrono / reference fields the caller provided.
 *   - missingFields      — list of expected fields that were absent or null.
 *   - inputConsistencyWarnings — descriptive warnings (e.g. observed
 *                          velocity supplied with no reference to compare).
 *   - sourceCoverage     — label describing which reference categories
 *                          (validation record, range session) supplied data.
 *   - velocityDelta      — fps + percent delta of observed-vs-reference
 *                          velocity, IF both values were supplied. This is
 *                          velocity, never pressure.
 *   - pressurePredictionStatus — always the literal string 'disabled'.
 *
 * These outputs describe the inputs the caller already supplied. The engine
 * does no extrapolation, ballistic simulation, or pressure inference.
 */

import { z } from 'zod';

// =============================================================================
// Forbidden output keys.
// =============================================================================
//
// Any key in an inbound request body or in a candidate outbound output object
// that matches one of these is rejected / stripped. Matching is exact and
// case-insensitive: we lower-case the candidate key and compare against the
// lower-cased values below.

export const FORBIDDEN_OUTPUT_KEYS = [
  'predictedpressurepsi',
  'predictedpressure',
  'pressureprediction',
  'peakpressure',
  'peakpressurepsi',
  'chamberpressure',
  'chamberpressurepsi',
  'maxpressure',
  'predictedpeakpressure',
  'safe',
  'unsafe',
  'issafe',
  'isunsafe',
  'safetyverdict',
  'safetyrating',
  'recommendedcharge',
  'recommendedchargegr',
  'maxchargerecommendation',
  'chargerecommendation',
  'loadadvice',
  'powdersubstitution',
  'powderswap',
  'increasecharge',
  'decreasecharge',
  'suggestedcharge',
  'safecharge',
  'unsafecharge',
] as const;

export const FORBIDDEN_OUTPUT_KEYS_MESSAGE =
  'The pressure engine does not accept or emit pressure predictions, ' +
  'charge recommendations, safe/unsafe verdicts, or powder substitutions. ' +
  'Remove forbidden fields and retry.';

export const ACKNOWLEDGEMENT_REQUIRED_MESSAGE =
  'You must confirm: "I understand the pressure engine does not predict ' +
  'pressure or recommend loads."';

/**
 * Return the lowercased keys of `body` that match the forbidden set. Empty
 * array if `body` is null/undefined/non-object or has no forbidden keys.
 *
 * The check is shallow on top-level keys AND recursive into nested objects
 * and arrays — we don't want a caller to smuggle a `predictedPressurePsi`
 * under `outputs.predictedPressurePsi` or `[{ predictedPressurePsi: ... }]`.
 */
export function findForbiddenKeys(value: unknown, depth = 0): string[] {
  if (depth > 8) return []; // hard cap on recursion to avoid pathological inputs.
  if (value == null) return [];
  if (Array.isArray(value)) {
    const found: string[] = [];
    for (const v of value) {
      for (const k of findForbiddenKeys(v, depth + 1)) found.push(k);
    }
    return found;
  }
  if (typeof value !== 'object') return [];
  const obj = value as Record<string, unknown>;
  const found: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const lc = k.toLowerCase();
    if ((FORBIDDEN_OUTPUT_KEYS as readonly string[]).includes(lc)) {
      found.push(k);
    }
    for (const nested of findForbiddenKeys(v, depth + 1)) found.push(nested);
  }
  return found;
}

/**
 * Remove any forbidden keys from a candidate output object before it is
 * persisted or serialized. This is a second-line defence: even if some
 * internal code attempted to emit a `predictedPressurePsi`, it would be
 * stripped here before leaving the server. Returns a NEW object — never
 * mutates the argument.
 */
export function stripForbiddenKeys<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripForbiddenKeys(v, depth + 1)) as unknown as T;
  }
  if (typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if ((FORBIDDEN_OUTPUT_KEYS as readonly string[]).includes(k.toLowerCase())) {
      continue; // dropped.
    }
    out[k] = stripForbiddenKeys(v, depth + 1);
  }
  return out as T;
}

// =============================================================================
// Engine run statuses (matches Prisma enum PressureEngineRunStatus).
// =============================================================================

export const PRESSURE_ENGINE_RUN_STATUSES = [
  'DRAFT',
  'INPUT_INCOMPLETE',
  'COMPLETED_NON_OPERATIONAL',
  'REJECTED_BY_GUARDRAIL',
  'ARCHIVED',
] as const;

export type PressureEngineRunStatus =
  (typeof PRESSURE_ENGINE_RUN_STATUSES)[number];

export const pressureEngineRunStatusSchema = z.enum(
  PRESSURE_ENGINE_RUN_STATUSES,
);

export const PRESSURE_ENGINE_STATUS_LABEL: Record<
  PressureEngineRunStatus,
  string
> = {
  DRAFT: 'Draft',
  INPUT_INCOMPLETE: 'Input incomplete',
  COMPLETED_NON_OPERATIONAL: 'Completed (non-operational)',
  REJECTED_BY_GUARDRAIL: 'Rejected by guardrail',
  ARCHIVED: 'Archived',
};

// =============================================================================
// Engine run request schema.
// =============================================================================

export const pressureEngineRunRequestSchema = z.object({
  modelVersionId: z.string().optional().nullable(),
  loadId: z.string().optional().nullable(),
  rangeSessionId: z.string().optional().nullable(),
  validationRecordId: z.string().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  acknowledgedExperimental: z.boolean(),
});

export type PressureEngineRunRequest = z.infer<
  typeof pressureEngineRunRequestSchema
>;

// =============================================================================
// Engine run input / output snapshot types.
// =============================================================================

export type EngineInputsSnapshot = {
  modelVersion: {
    id: string;
    name: string;
    status: string;
    governanceStatus: string | null;
  } | null;
  load: {
    id: string;
    name: string;
    cartridgeId: string;
    powderId: string;
    bulletId: string;
    chargeGr: number | null;
    cartridgeOalIn: number | null;
    safetyAcknowledged: boolean;
  } | null;
  rangeSession: {
    id: string;
    date: string;
    avgVelocityFps: number | null;
    esFps: number | null;
    sdFps: number | null;
    shotsFired: number | null;
  } | null;
  validationRecord: {
    id: string;
    referenceLabel: string;
    referenceVelocityFps: number | null;
    measuredVelocityFps: number | null;
    referencePressurePsi: number | null;
  } | null;
  solverInputCounts: {
    caseCapacity: number;
    bulletDimensions: number;
    powderMetadata: number;
    barrelGeometry: number;
    chronoCalibration: number;
  };
};

export type EngineSourceCoverage = {
  hasLinkedLoad: boolean;
  hasReferenceVelocity: boolean;
  hasObservedVelocity: boolean;
  hasReferencePressure: boolean; // user-entered from a published source, never computed
  hasRangeSession: boolean;
  hasModelVersion: boolean;
};

export type EngineRunOutputs = {
  // Always the literal string 'disabled'. Persisted to make the
  // non-operational status auditable per-row.
  pressurePredictionStatus: 'disabled';
  // Why the prediction is disabled. Stable copy intended for UI surfacing.
  pressurePredictionDisabledReason: string;
  // 0..1 fraction of required fields the caller supplied.
  dataCompleteness: number;
  // Required fields that were not supplied or were null.
  missingFields: string[];
  // Descriptive warnings about input consistency — never a safety verdict.
  inputConsistencyWarnings: string[];
  // What kinds of reference / observation data the run had access to.
  sourceCoverage: EngineSourceCoverage;
  // Velocity-only delta (fps + percent). Pressure is intentionally absent.
  velocityDeltaFps: number | null;
  velocityDeltaPct: number | null;
  // Reference vs observed velocity values surfaced for display.
  referenceVelocityFps: number | null;
  observedVelocityFps: number | null;
};

export const PRESSURE_PREDICTION_DISABLED_REASON =
  'Pressure prediction is disabled. The pressure engine is a controlled ' +
  'validation workspace only. No model has passed SAAMI/CIP/manufacturer ' +
  'data review, legal/safety review, and instrumented test validation. ' +
  'No PSI, peak-pressure, charge recommendation, or safe/unsafe verdict ' +
  'will be produced.';

// =============================================================================
// Pure runner: assemble inputs snapshot + non-prescriptive outputs.
// =============================================================================
//
// This function never reads or writes the database. Callers pass in already-
// fetched, workspace-scoped entities. Keeping it pure makes the safety
// guarantees verifiable: there is no surface for a future refactor to
// accidentally emit a pressure estimate.

export function runPressureEngine(args: {
  modelVersion: EngineInputsSnapshot['modelVersion'];
  load: EngineInputsSnapshot['load'];
  rangeSession: EngineInputsSnapshot['rangeSession'];
  validationRecord: EngineInputsSnapshot['validationRecord'];
  solverInputCounts: EngineInputsSnapshot['solverInputCounts'];
}): {
  inputs: EngineInputsSnapshot;
  outputs: EngineRunOutputs;
  status: PressureEngineRunStatus;
} {
  const inputs: EngineInputsSnapshot = {
    modelVersion: args.modelVersion,
    load: args.load,
    rangeSession: args.rangeSession,
    validationRecord: args.validationRecord,
    solverInputCounts: args.solverInputCounts,
  };

  // Source coverage.
  const sourceCoverage: EngineSourceCoverage = {
    hasLinkedLoad: !!args.load,
    hasModelVersion: !!args.modelVersion,
    hasReferenceVelocity: args.validationRecord?.referenceVelocityFps != null,
    hasObservedVelocity:
      args.rangeSession?.avgVelocityFps != null ||
      args.validationRecord?.measuredVelocityFps != null,
    hasReferencePressure: args.validationRecord?.referencePressurePsi != null,
    hasRangeSession: !!args.rangeSession,
  };

  // Required fields and missing list.
  const checks: Array<{ field: string; present: boolean }> = [
    { field: 'modelVersionId', present: !!args.modelVersion },
    { field: 'loadId', present: !!args.load },
    { field: 'rangeSessionOrValidationRecord', present: !!(args.rangeSession || args.validationRecord) },
    { field: 'referenceVelocityFps', present: sourceCoverage.hasReferenceVelocity },
    { field: 'observedVelocityFps', present: sourceCoverage.hasObservedVelocity },
    { field: 'caseCapacityMeasurement', present: args.solverInputCounts.caseCapacity > 0 },
    { field: 'bulletDimensionRecord', present: args.solverInputCounts.bulletDimensions > 0 },
    { field: 'powderMetadataRecord', present: args.solverInputCounts.powderMetadata > 0 },
    { field: 'barrelGeometryRecord', present: args.solverInputCounts.barrelGeometry > 0 },
    { field: 'chronoCalibrationRecord', present: args.solverInputCounts.chronoCalibration > 0 },
  ];
  const missingFields = checks.filter((c) => !c.present).map((c) => c.field);
  const dataCompleteness =
    checks.filter((c) => c.present).length / checks.length;

  // Velocity-only delta. The reference comes from the validation record's
  // user-entered referenceVelocityFps; the observed comes from the range
  // session's chrono avg, or from the validation record's measuredVelocityFps
  // when no session is linked. Pressure is intentionally never computed.
  const referenceVelocityFps =
    args.validationRecord?.referenceVelocityFps ?? null;
  const observedVelocityFps =
    args.rangeSession?.avgVelocityFps ??
    args.validationRecord?.measuredVelocityFps ??
    null;
  let velocityDeltaFps: number | null = null;
  let velocityDeltaPct: number | null = null;
  if (
    referenceVelocityFps != null &&
    observedVelocityFps != null &&
    Number.isFinite(referenceVelocityFps) &&
    Number.isFinite(observedVelocityFps)
  ) {
    velocityDeltaFps = observedVelocityFps - referenceVelocityFps;
    velocityDeltaPct =
      referenceVelocityFps === 0
        ? null
        : (velocityDeltaFps / referenceVelocityFps) * 100;
  }

  // Input-consistency warnings (descriptive only, never a safety verdict).
  const warnings: string[] = [];
  if (sourceCoverage.hasObservedVelocity && !sourceCoverage.hasReferenceVelocity) {
    warnings.push(
      'Observed velocity supplied with no reference velocity to compare against.',
    );
  }
  if (sourceCoverage.hasReferenceVelocity && !sourceCoverage.hasObservedVelocity) {
    warnings.push(
      'Reference velocity supplied with no observed velocity (range session avg or measured value).',
    );
  }
  if (args.load && args.load.chargeGr != null && !args.load.safetyAcknowledged) {
    warnings.push(
      'Linked load has a charge but no safety acknowledgement — review the load before relying on its values.',
    );
  }
  if (
    args.modelVersion &&
    args.modelVersion.governanceStatus &&
    args.modelVersion.governanceStatus !== 'validation_only' &&
    args.modelVersion.governanceStatus !== 'draft'
  ) {
    warnings.push(
      `Model version governance status is "${args.modelVersion.governanceStatus}" — engine remains non-operational regardless.`,
    );
  }

  // Status assignment. The runner never emits COMPLETED with pressure data;
  // it emits COMPLETED_NON_OPERATIONAL when inputs are sufficient for the
  // descriptive bookkeeping the engine actually performs.
  let status: PressureEngineRunStatus;
  if (missingFields.length >= checks.length - 1) {
    // essentially nothing supplied
    status = 'DRAFT';
  } else if (missingFields.length > 0) {
    status = 'INPUT_INCOMPLETE';
  } else {
    status = 'COMPLETED_NON_OPERATIONAL';
  }

  const outputs: EngineRunOutputs = {
    pressurePredictionStatus: 'disabled',
    pressurePredictionDisabledReason: PRESSURE_PREDICTION_DISABLED_REASON,
    dataCompleteness,
    missingFields,
    inputConsistencyWarnings: warnings,
    sourceCoverage,
    velocityDeltaFps,
    velocityDeltaPct,
    referenceVelocityFps,
    observedVelocityFps,
  };

  // Defence-in-depth: even though we constructed `outputs` ourselves with no
  // pressure-prediction keys, strip the candidate object through the
  // forbidden-key filter before returning. If a future refactor accidentally
  // introduces one, this catches it.
  const sanitisedOutputs = stripForbiddenKeys(outputs);

  return { inputs, outputs: sanitisedOutputs, status };
}

// =============================================================================
// Tiny smoke test helpers (callable from any node context — no Prisma deps).
// =============================================================================
//
// These are intentionally not wired into a test runner (the project ships
// without one). They give an in-process smoke check for the forbidden-key
// guardrail. Import and call from a one-off script if needed.

export function smokeCheckForbiddenKeys(): { passed: boolean; details: string[] } {
  const details: string[] = [];
  let passed = true;

  // findForbiddenKeys must catch every documented forbidden key.
  for (const k of FORBIDDEN_OUTPUT_KEYS) {
    const body = { [k]: 1 } as Record<string, unknown>;
    const found = findForbiddenKeys(body);
    if (found.length !== 1) {
      passed = false;
      details.push(`findForbiddenKeys missed top-level key "${k}"`);
    }
  }

  // findForbiddenKeys must recurse into nested objects.
  const nested = { outputs: { predictedPressurePsi: 1 } };
  if (findForbiddenKeys(nested).length === 0) {
    passed = false;
    details.push('findForbiddenKeys did not recurse into nested objects');
  }

  // findForbiddenKeys must recurse into arrays.
  const inArray = { items: [{ recommendedChargeGr: 1 }] };
  if (findForbiddenKeys(inArray).length === 0) {
    passed = false;
    details.push('findForbiddenKeys did not recurse into arrays');
  }

  // stripForbiddenKeys must drop top-level forbidden keys.
  const stripped = stripForbiddenKeys({
    predictedPressurePsi: 1,
    dataCompleteness: 0.5,
  }) as Record<string, unknown>;
  if ('predictedPressurePsi' in stripped || stripped.dataCompleteness !== 0.5) {
    passed = false;
    details.push('stripForbiddenKeys did not drop top-level forbidden key');
  }

  // stripForbiddenKeys must drop nested forbidden keys.
  const strippedNested = stripForbiddenKeys({
    outputs: { peakPressure: 99, ok: true },
  }) as { outputs: Record<string, unknown> };
  if ('peakPressure' in strippedNested.outputs) {
    passed = false;
    details.push('stripForbiddenKeys did not drop nested forbidden key');
  }

  // Case-insensitive matching.
  if (findForbiddenKeys({ PredictedPressurePsi: 1 }).length === 0) {
    passed = false;
    details.push('findForbiddenKeys is not case-insensitive');
  }

  return { passed, details };
}
