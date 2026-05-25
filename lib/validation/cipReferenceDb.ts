// Server-only DB helpers for the Shooters World / CIP Reference Center.
//
// User-facing helpers (listVerifiedCipRecords, getVerifiedCipRecord) return
// VERIFIED rows only. Admin-only helpers cover the full CRUD + verify flow
// and must be invoked only after getAdminContext() has succeeded.

import { prisma } from '@/lib/db/prisma';
import type {
  CipRecordCreateInput,
  CipRecordUpdateInput,
  CipVerificationStatus,
} from '@/lib/validation/cipReference';

export type CipReferenceRecord = Awaited<
  ReturnType<typeof prisma.cipReferenceRecord.findFirst>
>;

export type CipListFilters = {
  cartridge?: string | null;
  powder?: string | null;
  manufacturer?: string | null;
  status?: CipVerificationStatus | null;
  // Substring search on the structured notes fields produced by bulk import
  // (Projectile=…, Bullet weight=…). Filtering happens via a case-insensitive
  // `contains` on the `notes` column — accepted because the bulk-import writer
  // always emits a predictable `Projectile=` / `Bullet weight=` prefix.
  projectile?: string | null;
  bulletWeight?: string | null;
  // When true (admin-only), return rows whose verificationStatus is in
  // {VERIFIED, DRAFT, PENDING_REVIEW} so user-facing pages can offer an
  // optional "include needs review" toggle. RETIRED rows are always excluded
  // from this expanded view.
  includeNeedsReview?: boolean;
};

function whereForFilters(
  workspaceId: string,
  filters: CipListFilters | undefined,
  opts: { verifiedOnly: boolean },
) {
  const where: Record<string, unknown> = { workspaceId };
  if (opts.verifiedOnly) {
    if (filters?.includeNeedsReview) {
      where.verificationStatus = {
        in: ['VERIFIED', 'DRAFT', 'PENDING_REVIEW'],
      };
    } else {
      where.verificationStatus = 'VERIFIED';
    }
  } else if (filters?.status) {
    where.verificationStatus = filters.status;
  }
  if (filters?.cartridge) {
    where.cartridgeName = {
      contains: filters.cartridge,
      mode: 'insensitive',
    };
  }
  if (filters?.powder) {
    where.powderName = {
      contains: filters.powder,
      mode: 'insensitive',
    };
  }
  if (filters?.manufacturer) {
    where.powderManufacturer = {
      contains: filters.manufacturer,
      mode: 'insensitive',
    };
  }
  // Free-form notes substring filters. The bulk-import parser writes these as
  // `Projectile=…` / `Bullet weight=…` inside the `notes` field, so we filter
  // on the raw column. Hand-typed rows that put the same text into `notes`
  // also match — that's the documented behaviour.
  const noteContains: string[] = [];
  if (filters?.projectile) noteContains.push(filters.projectile);
  if (filters?.bulletWeight) noteContains.push(filters.bulletWeight);
  if (noteContains.length === 1) {
    where.notes = { contains: noteContains[0], mode: 'insensitive' };
  } else if (noteContains.length > 1) {
    where.AND = noteContains.map((s) => ({
      notes: { contains: s, mode: 'insensitive' },
    }));
  }
  return where;
}

// Verified, published-only listing for user-facing pages.
export async function listVerifiedCipRecords(
  workspaceId: string,
  filters?: CipListFilters,
) {
  return prisma.cipReferenceRecord.findMany({
    where: whereForFilters(workspaceId, filters, { verifiedOnly: true }),
    orderBy: [{ cartridgeName: 'asc' }, { updatedAt: 'desc' }],
    take: 500,
  });
}

// Full listing (any verification state) for the admin entry page.
export async function listAllCipRecords(
  workspaceId: string,
  filters?: CipListFilters,
) {
  return prisma.cipReferenceRecord.findMany({
    where: whereForFilters(workspaceId, filters, { verifiedOnly: false }),
    orderBy: [{ updatedAt: 'desc' }],
    take: 500,
  });
}

export async function getCipRecord(workspaceId: string, recordId: string) {
  return prisma.cipReferenceRecord.findFirst({
    where: { id: recordId, workspaceId },
  });
}

// User-facing single-row lookup (verified only).
export async function getVerifiedCipRecord(
  workspaceId: string,
  recordId: string,
) {
  return prisma.cipReferenceRecord.findFirst({
    where: {
      id: recordId,
      workspaceId,
      verificationStatus: 'VERIFIED',
    },
  });
}

export async function createCipRecord(
  workspaceId: string,
  createdByEmail: string | null,
  input: CipRecordCreateInput,
) {
  return prisma.cipReferenceRecord.create({
    data: {
      workspaceId,
      cartridgeName: input.cartridgeName,
      cartridgeCaliberLabel: input.cartridgeCaliberLabel ?? null,
      powderManufacturer: input.powderManufacturer ?? null,
      powderFamily: input.powderFamily ?? null,
      powderName: input.powderName ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sourceLabel: input.sourceLabel ?? null,
      sourceRevision: input.sourceRevision ?? null,
      sourceDate: input.sourceDate ?? null,
      pmaxValue: input.pmaxValue ?? null,
      pmaxUnit: input.pmaxUnit ?? null,
      referenceChamberVolume: input.referenceChamberVolume ?? null,
      referenceCombustionVolume: input.referenceCombustionVolume ?? null,
      volumeUnit: input.volumeUnit ?? null,
      riflingF: input.riflingF ?? null,
      riflingZ: input.riflingZ ?? null,
      riflingG: input.riflingG ?? null,
      notes: input.notes ?? null,
      // Imports / creates are NEVER auto-verified.
      verificationStatus: 'DRAFT',
      createdByEmail,
    },
  });
}

// Admin-only edit of a draft / pending row. Only the keys explicitly present
// in `patch` are touched — undefined values are left alone, null values clear
// the column. Verification metadata (verificationStatus, verifiedByEmail,
// verifiedAt) is intentionally NOT updatable through this helper; promote
// rows through verifyCipRecord / retireCipRecord instead.
export async function updateCipRecord(
  workspaceId: string,
  recordId: string,
  patch: CipRecordUpdateInput,
) {
  const existing = await prisma.cipReferenceRecord.findFirst({
    where: { id: recordId, workspaceId },
  });
  if (!existing) return { ok: false as const, reason: 'NOT_FOUND' as const };

  const data: Record<string, unknown> = {};
  // We translate `undefined` (omitted key) into "leave alone" and explicit
  // undefined-after-zod into the same. The schema's optionalString /
  // optionalFloat helpers preserve undefined for blank inputs, so editing a
  // single field never silently wipes the rest of the row.
  const assignIfPresent = <K extends keyof CipRecordUpdateInput>(
    key: K,
    value: CipRecordUpdateInput[K],
  ) => {
    if (value !== undefined) data[key as string] = value;
  };
  assignIfPresent('cartridgeName', patch.cartridgeName);
  assignIfPresent('cartridgeCaliberLabel', patch.cartridgeCaliberLabel);
  assignIfPresent('powderManufacturer', patch.powderManufacturer);
  assignIfPresent('powderFamily', patch.powderFamily);
  assignIfPresent('powderName', patch.powderName);
  assignIfPresent('sourceUrl', patch.sourceUrl);
  assignIfPresent('sourceLabel', patch.sourceLabel);
  assignIfPresent('sourceRevision', patch.sourceRevision);
  assignIfPresent('sourceDate', patch.sourceDate);
  assignIfPresent('pmaxValue', patch.pmaxValue);
  assignIfPresent('pmaxUnit', patch.pmaxUnit);
  assignIfPresent('referenceChamberVolume', patch.referenceChamberVolume);
  assignIfPresent('referenceCombustionVolume', patch.referenceCombustionVolume);
  assignIfPresent('volumeUnit', patch.volumeUnit);
  assignIfPresent('riflingF', patch.riflingF);
  assignIfPresent('riflingZ', patch.riflingZ);
  assignIfPresent('riflingG', patch.riflingG);
  assignIfPresent('notes', patch.notes);

  if (Object.keys(data).length === 0) {
    return { ok: true as const, record: existing, changed: false };
  }

  const updated = await prisma.cipReferenceRecord.update({
    where: { id: recordId },
    data,
  });
  return { ok: true as const, record: updated, changed: true };
}

export async function verifyCipRecord(
  workspaceId: string,
  recordId: string,
  verifiedByEmail: string | null,
) {
  // Refuse to verify a row that has no source URL — that would defeat the
  // point of "verified against the published source".
  const existing = await prisma.cipReferenceRecord.findFirst({
    where: { id: recordId, workspaceId },
  });
  if (!existing) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (!existing.sourceUrl) {
    return {
      ok: false as const,
      reason: 'MISSING_SOURCE_URL' as const,
    };
  }
  const updated = await prisma.cipReferenceRecord.update({
    where: { id: recordId },
    data: {
      verificationStatus: 'VERIFIED',
      verifiedByEmail,
      verifiedAt: new Date(),
    },
  });
  return { ok: true as const, record: updated };
}

export async function retireCipRecord(
  workspaceId: string,
  recordId: string,
) {
  const existing = await prisma.cipReferenceRecord.findFirst({
    where: { id: recordId, workspaceId },
  });
  if (!existing) return { ok: false as const, reason: 'NOT_FOUND' as const };
  const updated = await prisma.cipReferenceRecord.update({
    where: { id: recordId },
    data: { verificationStatus: 'RETIRED' },
  });
  return { ok: true as const, record: updated };
}

export async function deleteCipRecord(
  workspaceId: string,
  recordId: string,
) {
  const existing = await prisma.cipReferenceRecord.findFirst({
    where: { id: recordId, workspaceId },
  });
  if (!existing) return { ok: false as const, reason: 'NOT_FOUND' as const };
  await prisma.cipReferenceRecord.delete({ where: { id: recordId } });
  return { ok: true as const };
}
