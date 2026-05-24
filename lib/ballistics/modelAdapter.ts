/**
 * Internal ballistics model adapter — controlled, governance-first interface.
 *
 * SAFETY CONTRACT (enforced by this file and by every caller):
 *
 *   1. The default adapter (`DisabledDefaultAdapter`) is the only adapter
 *      shipped with the app. It returns ONLY non-prescriptive metadata:
 *      `pressurePredictionStatus: 'disabled'`, completeness, missing fields,
 *      warnings, and validation metadata. It produces NO PSI, NO peak/chamber
 *      pressure, NO charge recommendation, and NO safe/unsafe verdict.
 *
 *   2. Any adapter (default or future) MUST be passed through
 *      `sanitizeAdapterResponse` before its output crosses the server
 *      boundary. The sanitizer rejects responses that contain any of the
 *      forbidden keys (see `FORBIDDEN_OUTPUT_KEYS` in `pressureEngine.ts`)
 *      and strips forbidden keys defence-in-depth.
 *
 *   3. Adapters are intentionally not constructed from user input. The
 *      adapter registry below is hardcoded so a future production model
 *      can only be added by a code change that goes through review.
 *
 *   4. Adding a non-default adapter that returns numeric pressure outputs
 *      is OUT OF SCOPE for this file. Doing so would also require:
 *        - SAAMI / CIP / manufacturer reference data review,
 *        - legal / safety review of the predictions,
 *        - instrumented test-bench validation,
 *        - explicit approval workflow gating.
 *      Until those gates are documented and met, every adapter registered
 *      here MUST behave like `DisabledDefaultAdapter`.
 */

import { z } from 'zod';
import {
  FORBIDDEN_OUTPUT_KEYS,
  FORBIDDEN_OUTPUT_KEYS_MESSAGE,
  findForbiddenKeys,
  stripForbiddenKeys,
} from '@/lib/validation/pressureEngine';

// =============================================================================
// Adapter request / response shapes.
// =============================================================================

// Request that callers (validation harness, future engine integrations) send
// to an adapter. Intentionally minimal — adapters do not get raw DB rows.
// Anything sensitive (e.g. lab-only reference pressure values) is held by
// the harness and never passed into the adapter.
export const adapterRequestSchema = z.object({
  // Workspace context — adapters must never query across workspaces. They
  // are pure functions of the inputs we hand them; this id is recorded for
  // audit only.
  workspaceId: z.string(),
  // Identifier of the validation case being evaluated, if any.
  caseId: z.string().optional().nullable(),
  // Identifier of the dataset the case belongs to, if any.
  datasetId: z.string().optional().nullable(),
  // Solver-style inputs. All fields are optional — completeness is part of
  // what the adapter reports back. No pressure inputs are present.
  inputs: z
    .object({
      cartridgeName: z.string().optional().nullable(),
      bulletWeightGr: z.number().optional().nullable(),
      bulletDiameterIn: z.number().optional().nullable(),
      chargeGr: z.number().optional().nullable(),
      caseCapacityGrH2O: z.number().optional().nullable(),
      barrelLengthIn: z.number().optional().nullable(),
      twistRate: z.string().optional().nullable(),
      cartridgeOalIn: z.number().optional().nullable(),
      powderBurnRateLabel: z.string().optional().nullable(),
      tempF: z.number().optional().nullable(),
      // Observed velocity from a chronograph (fps). Velocity, never pressure.
      observedVelocityFps: z.number().optional().nullable(),
      // Reference velocity from a published source (fps). Velocity, never
      // pressure.
      referenceVelocityFps: z.number().optional().nullable(),
    })
    .partial()
    .default({}),
});

export type AdapterRequest = z.infer<typeof adapterRequestSchema>;

// Adapter response. The literal `pressurePredictionStatus: 'disabled'` is
// the default state. The field is intentionally typed as a string union so a
// future, validated model could emit a different non-pressure status label
// (e.g. 'velocity_only_estimate') without a destructive change — but it can
// never include the forbidden keys (those are rejected at the sanitizer).
export type AdapterPressurePredictionStatus =
  | 'disabled'
  | 'validation_only'
  | 'awaiting_review';

export type AdapterSourceCoverage = {
  hasReferenceVelocity: boolean;
  hasObservedVelocity: boolean;
  hasBulletData: boolean;
  hasPowderData: boolean;
  hasCaseCapacity: boolean;
  hasBarrelGeometry: boolean;
};

export type AdapterValidationMetadata = {
  // Name of the adapter that produced this response.
  adapterName: string;
  // SemVer-style version string, captured for audit.
  adapterVersion: string;
  // Governance status emitted by the adapter — must match its registry
  // entry. Used for display only; the runtime treats anything other than
  // 'disabled' as "still non-operational, do not surface predictions".
  governanceStatus: 'disabled' | 'draft' | 'validation_only' | 'retired';
  // Free-form blocked-outputs policy. Adapters must echo their policy so a
  // reviewer can see at a glance what they refuse to emit.
  blockedOutputsPolicy: string;
  // Whether the adapter has passed the validation harness for the supplied
  // dataset. Always false for the default adapter.
  validatedAgainstDataset: boolean;
};

export type AdapterResponse = {
  // ALWAYS one of the non-prescriptive labels. The default adapter always
  // emits 'disabled'.
  pressurePredictionStatus: AdapterPressurePredictionStatus;
  // Human-readable reason. Surfaced in admin UI.
  pressurePredictionDisabledReason: string;
  // 0..1 score of how many fields the request supplied. Pure descriptive
  // metric — not a safety verdict.
  dataCompleteness: number;
  // Field names that were absent or null.
  missingFields: string[];
  // Free-form input-consistency warnings. Never a "safe"/"unsafe" verdict.
  warnings: string[];
  // What kinds of reference / observation data the adapter was given.
  sourceCoverage: AdapterSourceCoverage;
  // Velocity-only delta (fps + percent), if both reference and observed
  // velocity were supplied. Velocity, never pressure.
  velocityDeltaFps: number | null;
  velocityDeltaPct: number | null;
  // Adapter / governance metadata.
  validation: AdapterValidationMetadata;
};

// =============================================================================
// Adapter interface.
// =============================================================================

export interface BallisticsModelAdapter {
  readonly name: string;
  readonly version: string;
  readonly governanceStatus: AdapterValidationMetadata['governanceStatus'];
  readonly blockedOutputsPolicy: string;
  // Pure function. Adapters MUST NOT do any I/O, must not call the database,
  // and must not throw on missing fields (return a completeness < 1 instead).
  evaluate(request: AdapterRequest): AdapterResponse;
}

// =============================================================================
// Default adapter — disabled, non-operational.
// =============================================================================

export const DISABLED_DEFAULT_ADAPTER_BLOCKED_OUTPUTS_POLICY =
  'No PSI / peak pressure / chamber pressure / charge recommendation / ' +
  'safe/unsafe verdict / powder substitution. Velocity deltas (fps) are ' +
  'reported only when both reference and observed velocities are supplied. ' +
  'Forbidden output keys are rejected by the server before persistence.';

const DEFAULT_DISABLED_REASON =
  'Default adapter. Pressure prediction is disabled. No model has passed ' +
  'SAAMI / CIP / manufacturer data review, legal / safety review, and ' +
  'instrumented test validation. No PSI, peak pressure, charge advice, or ' +
  'safe / unsafe verdict will be produced.';

class DisabledDefaultAdapter implements BallisticsModelAdapter {
  readonly name = 'disabled-default';
  readonly version = '0.1.0';
  readonly governanceStatus = 'disabled' as const;
  readonly blockedOutputsPolicy =
    DISABLED_DEFAULT_ADAPTER_BLOCKED_OUTPUTS_POLICY;

  evaluate(request: AdapterRequest): AdapterResponse {
    const inputs = request.inputs ?? {};

    const checks: Array<{ field: string; present: boolean }> = [
      { field: 'cartridgeName', present: !!inputs.cartridgeName },
      {
        field: 'bulletWeightGr',
        present: typeof inputs.bulletWeightGr === 'number',
      },
      {
        field: 'bulletDiameterIn',
        present: typeof inputs.bulletDiameterIn === 'number',
      },
      { field: 'chargeGr', present: typeof inputs.chargeGr === 'number' },
      {
        field: 'caseCapacityGrH2O',
        present: typeof inputs.caseCapacityGrH2O === 'number',
      },
      {
        field: 'barrelLengthIn',
        present: typeof inputs.barrelLengthIn === 'number',
      },
      { field: 'twistRate', present: !!inputs.twistRate },
      {
        field: 'cartridgeOalIn',
        present: typeof inputs.cartridgeOalIn === 'number',
      },
      {
        field: 'powderBurnRateLabel',
        present: !!inputs.powderBurnRateLabel,
      },
      {
        field: 'referenceVelocityFps',
        present: typeof inputs.referenceVelocityFps === 'number',
      },
      {
        field: 'observedVelocityFps',
        present: typeof inputs.observedVelocityFps === 'number',
      },
    ];
    const missingFields = checks.filter((c) => !c.present).map((c) => c.field);
    const dataCompleteness =
      checks.filter((c) => c.present).length / checks.length;

    const sourceCoverage: AdapterSourceCoverage = {
      hasReferenceVelocity: typeof inputs.referenceVelocityFps === 'number',
      hasObservedVelocity: typeof inputs.observedVelocityFps === 'number',
      hasBulletData:
        typeof inputs.bulletWeightGr === 'number' &&
        typeof inputs.bulletDiameterIn === 'number',
      hasPowderData: !!inputs.powderBurnRateLabel,
      hasCaseCapacity: typeof inputs.caseCapacityGrH2O === 'number',
      hasBarrelGeometry:
        typeof inputs.barrelLengthIn === 'number' || !!inputs.twistRate,
    };

    const warnings: string[] = [];
    if (sourceCoverage.hasObservedVelocity && !sourceCoverage.hasReferenceVelocity) {
      warnings.push(
        'Observed velocity supplied with no reference velocity to compare against.',
      );
    }
    if (sourceCoverage.hasReferenceVelocity && !sourceCoverage.hasObservedVelocity) {
      warnings.push(
        'Reference velocity supplied with no observed velocity to compare against.',
      );
    }

    let velocityDeltaFps: number | null = null;
    let velocityDeltaPct: number | null = null;
    if (
      typeof inputs.observedVelocityFps === 'number' &&
      typeof inputs.referenceVelocityFps === 'number' &&
      Number.isFinite(inputs.observedVelocityFps) &&
      Number.isFinite(inputs.referenceVelocityFps)
    ) {
      velocityDeltaFps =
        inputs.observedVelocityFps - inputs.referenceVelocityFps;
      velocityDeltaPct =
        inputs.referenceVelocityFps === 0
          ? null
          : (velocityDeltaFps / inputs.referenceVelocityFps) * 100;
    }

    const response: AdapterResponse = {
      pressurePredictionStatus: 'disabled',
      pressurePredictionDisabledReason: DEFAULT_DISABLED_REASON,
      dataCompleteness,
      missingFields,
      warnings,
      sourceCoverage,
      velocityDeltaFps,
      velocityDeltaPct,
      validation: {
        adapterName: this.name,
        adapterVersion: this.version,
        governanceStatus: this.governanceStatus,
        blockedOutputsPolicy: this.blockedOutputsPolicy,
        validatedAgainstDataset: false,
      },
    };

    // Defence-in-depth: even though we built the response ourselves, strip
    // any forbidden keys before returning. If a future refactor adds one,
    // this catches it.
    return stripForbiddenKeys(response);
  }
}

// =============================================================================
// Adapter registry — hardcoded, code-only.
// =============================================================================
//
// New adapters cannot be registered from user input. Adding one requires a
// code change, a code review, and explicit governance sign-off. The current
// registry intentionally exposes only the disabled-default adapter.

const ADAPTERS: Record<string, BallisticsModelAdapter> = {
  'disabled-default': new DisabledDefaultAdapter(),
};

export function listAdapters(): Array<{
  name: string;
  version: string;
  governanceStatus: BallisticsModelAdapter['governanceStatus'];
  blockedOutputsPolicy: string;
}> {
  return Object.values(ADAPTERS).map((a) => ({
    name: a.name,
    version: a.version,
    governanceStatus: a.governanceStatus,
    blockedOutputsPolicy: a.blockedOutputsPolicy,
  }));
}

export function getAdapter(
  name: string | null | undefined,
): BallisticsModelAdapter {
  if (!name) return ADAPTERS['disabled-default'];
  const a = ADAPTERS[name];
  if (!a) return ADAPTERS['disabled-default'];
  return a;
}

export const DEFAULT_ADAPTER_NAME = 'disabled-default';

// =============================================================================
// Adapter response sanitizer.
// =============================================================================
//
// Used by the validation harness and by any future engine integration before
// persisting / returning an adapter response. Reuses the existing forbidden-
// key set so the rules are centralized.

export type SanitizeResult =
  | { ok: true; response: AdapterResponse }
  | { ok: false; rejectedKeys: string[]; message: string };

export function sanitizeAdapterResponse(
  raw: unknown,
): SanitizeResult {
  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    return {
      ok: false,
      rejectedKeys: forbidden,
      message: FORBIDDEN_OUTPUT_KEYS_MESSAGE,
    };
  }
  // Strip even when no forbidden keys are found — cheap belt-and-braces.
  const stripped = stripForbiddenKeys(raw) as AdapterResponse;
  // Final invariant: pressurePredictionStatus must be one of the allowed
  // non-prescriptive labels. Anything else is treated as an adapter bug and
  // forced back to 'disabled'.
  const allowedStatuses: AdapterPressurePredictionStatus[] = [
    'disabled',
    'validation_only',
    'awaiting_review',
  ];
  if (
    !stripped ||
    typeof stripped !== 'object' ||
    !allowedStatuses.includes(
      stripped.pressurePredictionStatus as AdapterPressurePredictionStatus,
    )
  ) {
    return {
      ok: false,
      rejectedKeys: ['pressurePredictionStatus'],
      message:
        'Adapter response missing or has invalid pressurePredictionStatus. ' +
        'Allowed values: disabled, validation_only, awaiting_review.',
    };
  }
  return { ok: true, response: stripped };
}

// Re-export for callers that want the centralized forbidden-key list and
// shallow / recursive forbidden-key check.
export {
  FORBIDDEN_OUTPUT_KEYS,
  FORBIDDEN_OUTPUT_KEYS_MESSAGE,
  findForbiddenKeys,
  stripForbiddenKeys,
};

// =============================================================================
// Smoke test — runnable from any node context, no Prisma needed.
// =============================================================================

export function smokeCheckAdapter(): { passed: boolean; details: string[] } {
  const details: string[] = [];
  let passed = true;
  const adapter = getAdapter(DEFAULT_ADAPTER_NAME);

  // Default adapter must never return a forbidden key.
  const r = adapter.evaluate({
    workspaceId: 'ws-test',
    inputs: {
      cartridgeName: '6.5 Creedmoor',
      bulletWeightGr: 140,
      bulletDiameterIn: 0.264,
      chargeGr: 41.5,
      observedVelocityFps: 2700,
      referenceVelocityFps: 2710,
    },
  });
  if (r.pressurePredictionStatus !== 'disabled') {
    passed = false;
    details.push(
      `Default adapter returned status "${r.pressurePredictionStatus}", expected "disabled".`,
    );
  }
  if (findForbiddenKeys(r).length > 0) {
    passed = false;
    details.push('Default adapter emitted a forbidden key.');
  }
  if (r.velocityDeltaFps !== -10) {
    passed = false;
    details.push(
      `Default adapter velocityDeltaFps was ${r.velocityDeltaFps}, expected -10.`,
    );
  }

  // sanitizeAdapterResponse must reject a response that contains a forbidden
  // key, no matter how deeply nested.
  const evil = sanitizeAdapterResponse({
    pressurePredictionStatus: 'disabled',
    nested: { predictedPressurePsi: 60000 },
  });
  if (evil.ok) {
    passed = false;
    details.push('sanitizeAdapterResponse failed to reject nested forbidden key.');
  }

  // sanitizeAdapterResponse must reject an unknown pressurePredictionStatus.
  const wrong = sanitizeAdapterResponse({
    pressurePredictionStatus: 'enabled',
  });
  if (wrong.ok) {
    passed = false;
    details.push(
      'sanitizeAdapterResponse accepted pressurePredictionStatus="enabled".',
    );
  }

  return { passed, details };
}
