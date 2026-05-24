/**
 * Model validation harness — admin-only.
 *
 * SAFETY:
 *   - A validation dataset contains REFERENCE rows transcribed from licensed
 *     / published sources or measured at a controlled test bench. Any
 *     pressure values in a case (`referencePressurePsi`) are user-entered
 *     reference inputs — never computed by this app. They are stored for
 *     audit / future calibration check only, are admin-only, and are never
 *     rendered as load guidance.
 *
 *   - Running the harness against an adapter goes through the forbidden-key
 *     sanitizer. Any adapter response containing a pressure-prediction key,
 *     a charge recommendation, or a safe / unsafe verdict is rejected, the
 *     run is marked REJECTED_BY_GUARDRAIL, and the rejected keys are
 *     captured in the audit log.
 *
 *   - The harness emits velocity-only deltas. It DOES NOT emit pressure
 *     deltas, even when both the reference case and the adapter (hypothetically)
 *     had a pressure value, because the default adapter never has one and any
 *     future adapter that did would need to clear the gates documented in
 *     README before any pressure value could leave the admin surface.
 */

import { z } from 'zod';
import {
  type AdapterRequest,
  type AdapterResponse,
  type BallisticsModelAdapter,
  sanitizeAdapterResponse,
} from '@/lib/ballistics/modelAdapter';

// =============================================================================
// Dataset / case / run schemas.
// =============================================================================

export const DATASET_KINDS = [
  'published',
  'manufacturer',
  'lab',
  'internal_test',
] as const;
export type ValidationDatasetKind = (typeof DATASET_KINDS)[number];

export const datasetCreateSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(DATASET_KINDS),
  description: z.string().max(4000).optional().nullable(),
  // Reference identifier — DOI, manual page reference, lab report id, etc.
  // Stored as metadata only; we do not crawl / fetch external sources from
  // this row.
  referenceIdentifier: z.string().max(500).optional().nullable(),
  // Free-form licensing / attribution note.
  licenseNote: z.string().max(2000).optional().nullable(),
  // Acknowledgement: the admin states this is a validation dataset and not
  // a load guidance dataset.
  acknowledgedValidationOnly: z.boolean(),
});
export type DatasetCreateInput = z.infer<typeof datasetCreateSchema>;

export const caseCreateSchema = z.object({
  datasetId: z.string().min(1),
  label: z.string().min(1).max(200),
  cartridgeName: z.string().max(200).optional().nullable(),
  bulletWeightGr: z.number().optional().nullable(),
  bulletDiameterIn: z.number().optional().nullable(),
  chargeGr: z.number().optional().nullable(),
  caseCapacityGrH2O: z.number().optional().nullable(),
  barrelLengthIn: z.number().optional().nullable(),
  twistRate: z.string().max(100).optional().nullable(),
  cartridgeOalIn: z.number().optional().nullable(),
  powderBurnRateLabel: z.string().max(200).optional().nullable(),
  tempF: z.number().optional().nullable(),
  // Reference values from the source. Velocity is shared; pressure is
  // admin-only validation reference and is never surfaced as guidance.
  referenceVelocityFps: z.number().optional().nullable(),
  referencePressurePsi: z.number().optional().nullable(),
  // Optional observation (e.g. lab-measured velocity). Used for the
  // velocity-delta surfaced by the harness.
  observedVelocityFps: z.number().optional().nullable(),
  pageLabel: z.string().max(200).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});
export type CaseCreateInput = z.infer<typeof caseCreateSchema>;

export const runCreateSchema = z.object({
  datasetId: z.string().min(1),
  adapterName: z.string().min(1).max(100),
  modelVersionId: z.string().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  acknowledgedValidationOnly: z.boolean(),
});
export type RunCreateInput = z.infer<typeof runCreateSchema>;

// =============================================================================
// Harness types.
// =============================================================================

export const VALIDATION_RUN_STATUSES = [
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETED_NON_OPERATIONAL',
  'REJECTED_BY_GUARDRAIL',
  'ERRORED',
  'ARCHIVED',
] as const;
export type ValidationRunStatus = (typeof VALIDATION_RUN_STATUSES)[number];

export type ValidationCaseInput = {
  id: string;
  label: string;
  cartridgeName: string | null;
  bulletWeightGr: number | null;
  bulletDiameterIn: number | null;
  chargeGr: number | null;
  caseCapacityGrH2O: number | null;
  barrelLengthIn: number | null;
  twistRate: string | null;
  cartridgeOalIn: number | null;
  powderBurnRateLabel: string | null;
  tempF: number | null;
  referenceVelocityFps: number | null;
  // Admin-only reference value. Surfaced in admin UI as "lab/published
  // pressure (reference)"; never rendered as guidance.
  referencePressurePsi: number | null;
  observedVelocityFps: number | null;
};

export type CaseResult = {
  caseId: string;
  caseLabel: string;
  pressurePredictionStatus: AdapterResponse['pressurePredictionStatus'];
  dataCompleteness: number;
  missingFields: string[];
  warnings: string[];
  // Velocity-only delta between observed and reference. Pressure is never
  // computed by the harness.
  velocityDeltaFps: number | null;
  velocityDeltaPct: number | null;
  withinTolerance: boolean | null;
  // True iff the adapter response was sanitized to remove a forbidden key
  // OR rejected outright. Tracked for audit.
  guardrailTriggered: boolean;
  guardrailRejectedKeys: string[];
};

export type HarnessSummary = {
  totalCases: number;
  completedCases: number;
  guardrailRejections: number;
  withinToleranceCount: number | null;
  meanVelocityDeltaFps: number | null;
  meanAbsVelocityDeltaFps: number | null;
  // Always 'disabled' or another non-prescriptive label. If any case's
  // adapter response leaked a non-allowed status, the run is rejected.
  pressurePredictionStatus: AdapterResponse['pressurePredictionStatus'];
};

export type HarnessRunResult = {
  status: ValidationRunStatus;
  summary: HarnessSummary;
  caseResults: CaseResult[];
  adapterMetadata: AdapterResponse['validation'] | null;
  rejectedReason: string | null;
};

// =============================================================================
// Pure harness runner.
// =============================================================================
//
// Does no I/O. Caller passes the adapter and the already-fetched cases.

export function runValidationHarness(args: {
  workspaceId: string;
  datasetId: string;
  cases: ValidationCaseInput[];
  adapter: BallisticsModelAdapter;
  toleranceFps?: number;
}): HarnessRunResult {
  const toleranceFps =
    typeof args.toleranceFps === 'number' && args.toleranceFps > 0
      ? args.toleranceFps
      : 50;

  const caseResults: CaseResult[] = [];
  let guardrailRejections = 0;
  let velocityDeltaSum = 0;
  let velocityDeltaAbsSum = 0;
  let velocityDeltaCount = 0;
  let withinTolerance = 0;
  let withinToleranceObserved = 0;
  let observedStatus: AdapterResponse['pressurePredictionStatus'] = 'disabled';
  let adapterMetadata: AdapterResponse['validation'] | null = null;

  for (const c of args.cases) {
    const request: AdapterRequest = {
      workspaceId: args.workspaceId,
      caseId: c.id,
      datasetId: args.datasetId,
      inputs: {
        cartridgeName: c.cartridgeName,
        bulletWeightGr: c.bulletWeightGr,
        bulletDiameterIn: c.bulletDiameterIn,
        chargeGr: c.chargeGr,
        caseCapacityGrH2O: c.caseCapacityGrH2O,
        barrelLengthIn: c.barrelLengthIn,
        twistRate: c.twistRate,
        cartridgeOalIn: c.cartridgeOalIn,
        powderBurnRateLabel: c.powderBurnRateLabel,
        tempF: c.tempF,
        observedVelocityFps: c.observedVelocityFps,
        referenceVelocityFps: c.referenceVelocityFps,
      },
    };

    let raw: AdapterResponse;
    try {
      raw = args.adapter.evaluate(request);
    } catch {
      // Adapter threw — treat as guardrail rejection so the run is still
      // auditable.
      guardrailRejections += 1;
      caseResults.push({
        caseId: c.id,
        caseLabel: c.label,
        pressurePredictionStatus: 'disabled',
        dataCompleteness: 0,
        missingFields: [],
        warnings: ['Adapter threw an error evaluating this case.'],
        velocityDeltaFps: null,
        velocityDeltaPct: null,
        withinTolerance: null,
        guardrailTriggered: true,
        guardrailRejectedKeys: ['__adapter_threw'],
      });
      continue;
    }

    const sanitized = sanitizeAdapterResponse(raw);
    if (!sanitized.ok) {
      guardrailRejections += 1;
      caseResults.push({
        caseId: c.id,
        caseLabel: c.label,
        pressurePredictionStatus: 'disabled',
        dataCompleteness: 0,
        missingFields: [],
        warnings: [sanitized.message],
        velocityDeltaFps: null,
        velocityDeltaPct: null,
        withinTolerance: null,
        guardrailTriggered: true,
        guardrailRejectedKeys: sanitized.rejectedKeys,
      });
      continue;
    }
    const resp = sanitized.response;
    observedStatus = resp.pressurePredictionStatus;
    adapterMetadata = resp.validation;

    let caseWithinTolerance: boolean | null = null;
    if (typeof resp.velocityDeltaFps === 'number') {
      velocityDeltaSum += resp.velocityDeltaFps;
      velocityDeltaAbsSum += Math.abs(resp.velocityDeltaFps);
      velocityDeltaCount += 1;
      withinToleranceObserved += 1;
      caseWithinTolerance = Math.abs(resp.velocityDeltaFps) <= toleranceFps;
      if (caseWithinTolerance) withinTolerance += 1;
    }

    caseResults.push({
      caseId: c.id,
      caseLabel: c.label,
      pressurePredictionStatus: resp.pressurePredictionStatus,
      dataCompleteness: resp.dataCompleteness,
      missingFields: resp.missingFields,
      warnings: resp.warnings,
      velocityDeltaFps: resp.velocityDeltaFps,
      velocityDeltaPct: resp.velocityDeltaPct,
      withinTolerance: caseWithinTolerance,
      guardrailTriggered: false,
      guardrailRejectedKeys: [],
    });
  }

  const completedCases = caseResults.filter((r) => !r.guardrailTriggered).length;
  const status: ValidationRunStatus =
    args.cases.length === 0
      ? 'DRAFT'
      : guardrailRejections === args.cases.length
        ? 'REJECTED_BY_GUARDRAIL'
        : 'COMPLETED_NON_OPERATIONAL';

  const summary: HarnessSummary = {
    totalCases: args.cases.length,
    completedCases,
    guardrailRejections,
    withinToleranceCount:
      withinToleranceObserved > 0 ? withinTolerance : null,
    meanVelocityDeltaFps:
      velocityDeltaCount > 0 ? velocityDeltaSum / velocityDeltaCount : null,
    meanAbsVelocityDeltaFps:
      velocityDeltaCount > 0 ? velocityDeltaAbsSum / velocityDeltaCount : null,
    pressurePredictionStatus: observedStatus,
  };

  return {
    status,
    summary,
    caseResults,
    adapterMetadata,
    rejectedReason:
      status === 'REJECTED_BY_GUARDRAIL'
        ? 'All cases rejected by the forbidden-output guardrail. No adapter response was accepted.'
        : null,
  };
}

export const VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE =
  'You must confirm this dataset/run is validation-only and will not be used ' +
  'as load guidance.';
