/**
 * Server-side validation for Load saves.
 *
 * Safety rules (enforced here, never bypassed):
 *   1. A "charge-bearing save" (any record where chargeGr is set) MUST cite a
 *      published Source. Drafts with no chargeGr can be saved without a source.
 *   2. A charge-bearing save MUST have safetyAcknowledged === true.
 *   3. chargeGr MUST NOT exceed the cited Source.publishedMaxGr.
 *   4. We NEVER suggest replacement / corrected values. Errors describe what
 *      the user must change; we do not return a recommended charge.
 *
 * This module is intentionally framework-agnostic: it works in route handlers
 * and server actions alike.
 */

import { z } from 'zod';

export const loadInputSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  status: z.enum(['DRAFT', 'PLANNED', 'LOADED', 'TESTED', 'ARCHIVED']).default('DRAFT'),
  cartridgeId: z.string().min(1),
  bulletId: z.string().min(1),
  powderId: z.string().min(1),
  primerId: z.string().optional().nullable(),
  caseId: z.string().optional().nullable(),
  rifleId: z.string().optional().nullable(),
  sourceId: z.string().optional().nullable(),

  chargeGr: z.number().positive().optional().nullable(),
  cartridgeOalIn: z.number().positive().optional().nullable(),
  cartridgeBaseToOgiveIn: z.number().positive().optional().nullable(),
  caseTrimLengthIn: z.number().positive().optional().nullable(),
  neckTensionThou: z.number().min(0).optional().nullable(),

  safetyAcknowledged: z.boolean().default(false),
  safetyNotes: z.string().max(2000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export type LoadInput = z.infer<typeof loadInputSchema>;

export type SourceForValidation = {
  id: string;
  publishedMaxGr: number | null;
};

export type ValidationIssue = {
  field?: keyof LoadInput | 'safety';
  code:
    | 'INVALID_SHAPE'
    | 'SOURCE_REQUIRED_FOR_CHARGE'
    | 'ACK_REQUIRED_FOR_CHARGE'
    | 'CHARGE_EXCEEDS_PUBLISHED_MAX'
    | 'SOURCE_MISSING_PUBLISHED_MAX';
  message: string;
};

export type ValidationResult =
  | { ok: true; data: LoadInput }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Validate a Load payload against safety rules.
 *
 * `source` is optional: callers should resolve it from `sourceId` before
 * calling this helper so the validation can compare chargeGr to publishedMax.
 */
export function validateLoad(
  input: unknown,
  source: SourceForValidation | null = null,
): ValidationResult {
  const parsed = loadInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        field: (i.path[0] as keyof LoadInput) ?? undefined,
        code: 'INVALID_SHAPE',
        message: i.message,
      })),
    };
  }

  const data = parsed.data;
  const issues: ValidationIssue[] = [];
  const isChargeBearing = data.chargeGr !== null && data.chargeGr !== undefined;

  if (isChargeBearing) {
    if (!data.sourceId) {
      issues.push({
        field: 'sourceId',
        code: 'SOURCE_REQUIRED_FOR_CHARGE',
        message:
          'A published reference Source must be cited before saving any charge weight.',
      });
    }

    if (!data.safetyAcknowledged) {
      issues.push({
        field: 'safety',
        code: 'ACK_REQUIRED_FOR_CHARGE',
        message:
          'You must explicitly acknowledge the safety disclaimer before saving a charge weight.',
      });
    }

    if (data.sourceId && source) {
      if (source.publishedMaxGr === null || source.publishedMaxGr === undefined) {
        issues.push({
          field: 'sourceId',
          code: 'SOURCE_MISSING_PUBLISHED_MAX',
          message:
            'The cited Source does not record a published maximum charge. Update the Source with the published max before saving a charge weight.',
        });
      } else if ((data.chargeGr ?? 0) > source.publishedMaxGr) {
        issues.push({
          field: 'chargeGr',
          code: 'CHARGE_EXCEEDS_PUBLISHED_MAX',
          // NOTE: we intentionally do NOT suggest a corrected charge. The user
          // must consult their cited published source and decide for themselves.
          message:
            'Charge exceeds the published maximum recorded on the cited Source. LoadBench Pro will not save loads above a cited published maximum.',
        });
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, data };
}
