// Server-only DB helpers for the Shooters World / CIP Reference Center.
//
// User-facing helpers (listVerifiedCipRecords, getVerifiedCipRecord) return
// VERIFIED rows only. Admin-only helpers cover the full CRUD + verify flow
// and must be invoked only after getAdminContext() has succeeded.

import { prisma } from '@/lib/db/prisma';
import type {
  CipRecordCreateInput,
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
};

function whereForFilters(
  workspaceId: string,
  filters: CipListFilters | undefined,
  opts: { verifiedOnly: boolean },
) {
  const where: Record<string, unknown> = { workspaceId };
  if (opts.verifiedOnly) {
    where.verificationStatus = 'VERIFIED';
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
