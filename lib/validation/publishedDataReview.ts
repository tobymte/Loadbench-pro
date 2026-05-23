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
});
