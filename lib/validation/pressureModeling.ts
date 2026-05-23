/**
 * Validation for experimental pressure-modeling test bench inputs.
 *
 * These schemas guard storage of user-entered structured notes. They do not
 * enable any pressure prediction. No field is treated as a load
 * recommendation, and no save is interpreted as a safety claim.
 */

import { z } from 'zod';

export const PRESSURE_MODEL_STATUSES = [
  'DRAFT',
  'READY_FOR_EXPERT_REVIEW',
  'BLOCKED',
  'VALIDATED_REFERENCE',
  'REJECTED',
] as const;

export const pressureModelStatusSchema = z.enum(PRESSURE_MODEL_STATUSES);

export const pressureModelVersionInputSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(2000).optional().nullable(),
  status: pressureModelStatusSchema.default('DRAFT'),
  notes: z.string().max(4000).optional().nullable(),
});

export type PressureModelVersionInput = z.infer<
  typeof pressureModelVersionInputSchema
>;

export const pressureValidationRecordInputSchema = z.object({
  referenceLabel: z.string().min(1, 'Reference label is required').max(240),
  loadId: z.string().optional().nullable(),
  sourceId: z.string().optional().nullable(),
  modelVersionId: z.string().optional().nullable(),
  // Numeric reference values. Stored only — no formula reads from these.
  // Bounds are sanity checks (rejecting nonsense) not safety thresholds.
  referencePressurePsi: z
    .number()
    .int()
    .min(0)
    .max(200_000)
    .optional()
    .nullable(),
  referenceVelocityFps: z.number().min(0).max(10_000).optional().nullable(),
  measuredVelocityFps: z.number().min(0).max(10_000).optional().nullable(),
  conditionsJson: z.string().max(8000).optional().nullable(),
  status: pressureModelStatusSchema.default('DRAFT'),
  notes: z.string().max(4000).optional().nullable(),
  // The user must explicitly acknowledge that this is experimental
  // validation data only before the row is saved.
  acknowledged: z.boolean(),
});

export type PressureValidationRecordInput = z.infer<
  typeof pressureValidationRecordInputSchema
>;

export const ACKNOWLEDGEMENT_REQUIRED_MESSAGE =
  'You must acknowledge that this is experimental validation data only before saving.';
