import { z } from 'zod';

// Zod schemas for the published-data review/staging workflow.
// Rows captured here are NOT operational loads and are NOT recommendations;
// the UI/API surface them only so a workspace member can verify them against
// the original published document before any downstream use.

export const publishedLoadRowStatusSchema = z.enum([
  'DRAFT',
  'NEEDS_REVIEW',
  'VERIFIED',
  'REJECTED',
]);

export const publishedDataImportStatusSchema = z.enum([
  'DRAFT',
  'IN_REVIEW',
  'ARCHIVED',
]);

export const publishedLoadRowDraftInputSchema = z.object({
  importId: z.string().min(1),
  sourceId: z.string().min(1).optional().nullable(),
  cartridgeId: z.string().min(1).optional().nullable(),
  bulletComponentId: z.string().min(1).optional().nullable(),
  powderComponentId: z.string().min(1).optional().nullable(),
  pageLabel: z.string().max(120).optional().nullable(),
  bulletWeightGr: z.number().positive().max(1000).optional().nullable(),
  bulletName: z.string().max(240).optional().nullable(),
  powderName: z.string().max(240).optional().nullable(),
  chargeGr: z.number().positive().max(1000).optional().nullable(),
  velocityFps: z.number().positive().max(10000).optional().nullable(),
  isMaxLoad: z.boolean().optional(),
  colIn: z.number().positive().max(10).optional().nullable(),
  bcG1: z.number().positive().max(2).optional().nullable(),
  bcG7: z.number().positive().max(2).optional().nullable(),
  status: publishedLoadRowStatusSchema.optional(),
  notes: z.string().max(4000).optional().nullable(),
});

export const publishedLoadRowDraftUpdateSchema = z.object({
  status: publishedLoadRowStatusSchema.optional(),
  pageLabel: z.string().max(120).optional().nullable(),
  bulletWeightGr: z.number().positive().max(1000).optional().nullable(),
  bulletName: z.string().max(240).optional().nullable(),
  powderName: z.string().max(240).optional().nullable(),
  chargeGr: z.number().positive().max(1000).optional().nullable(),
  velocityFps: z.number().positive().max(10000).optional().nullable(),
  isMaxLoad: z.boolean().optional(),
  colIn: z.number().positive().max(10).optional().nullable(),
  bcG1: z.number().positive().max(2).optional().nullable(),
  bcG7: z.number().positive().max(2).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  // When the caller is transitioning the row to VERIFIED, they must explicitly
  // confirm that they have checked the transcription against the original
  // published document. The PATCH route rejects status=VERIFIED without this.
  verificationAcknowledged: z.boolean().optional(),
});

// Schema for creating a Load draft from a VERIFIED row. The user must
// explicitly acknowledge the safety disclaimer at the create action — we never
// auto-inherit acknowledgement from the row verification step.
export const createLoadDraftFromRowSchema = z.object({
  safetyAcknowledged: z.literal(true, {
    errorMap: () => ({
      message:
        'You must explicitly acknowledge the safety disclaimer before creating a load draft.',
    }),
  }),
  name: z.string().min(1).max(120).optional(),
  notes: z.string().max(4000).optional().nullable(),
});
