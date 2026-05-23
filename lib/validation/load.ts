/**
 * Server-side validation for Load saves.
 *
 * Safety rules (enforced here, never bypassed):
 *   1. A "charge-bearing save" (any record where chargeGr is set) MUST cite a
 *      published Source. Drafts with no chargeGr can be saved without a source.
 *   2. A charge-bearing save MUST have safetyAcknowledged === true.
 *   3. chargeGr MUST NOT exceed the cited published maximum. The published
 *      max may be either:
 *        a) a row-specific published max supplied on the payload as
 *           `publishedMaxChargeGr` (e.g. when a Load is being created from a
 *           verified PublishedLoadRowDraft that records its own row maximum),
 *           OR
 *        b) the cited `Source.publishedMaxGr` (the source-wide max).
 *      If a row-specific max is supplied on the payload it takes precedence
 *      over the source-wide max for the charge ceiling check. If no
 *      row-specific max is supplied, the source-wide max is required.
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

  // Row-specific published maximum charge, when this Load is being created
  // from a verified PublishedLoadRowDraft that supplies its own row maximum.
  // When supplied, it overrides Source.publishedMaxGr for the charge ceiling.
  publishedMaxChargeGr: z.number().positive().optional().nullable(),
  // Citation context captured alongside a row-specific max.
  publishedDataRowId: z.string().optional().nullable(),
  sourcePageLabel: z.string().max(240).optional().nullable(),

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
    | 'CHARGE_EXCEEDS_ROW_PUBLISHED_MAX'
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
 *
 * If the payload carries a `publishedMaxChargeGr` (row-specific maximum from
 * a verified PublishedLoadRowDraft), the charge ceiling is checked against
 * that row-specific value and the source-wide max is not required.
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
  const hasRowMax =
    data.publishedMaxChargeGr !== null &&
    data.publishedMaxChargeGr !== undefined;

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

    if (hasRowMax) {
      // Row-specific max takes precedence over source-wide max.
      if ((data.chargeGr ?? 0) > (data.publishedMaxChargeGr ?? 0)) {
        issues.push({
          field: 'chargeGr',
          code: 'CHARGE_EXCEEDS_ROW_PUBLISHED_MAX',
          // We intentionally do NOT suggest a corrected charge.
          message:
            'Charge exceeds the published maximum recorded on the cited published row. LoadBench Pro will not save loads above a cited published maximum.',
        });
      }
    } else if (data.sourceId && source) {
      if (source.publishedMaxGr === null || source.publishedMaxGr === undefined) {
        issues.push({
          field: 'sourceId',
          code: 'SOURCE_MISSING_PUBLISHED_MAX',
          message:
            'The cited Source does not record a published maximum charge. Update the Source with the published max, or cite a verified published row that records its own row maximum, before saving a charge weight.',
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
