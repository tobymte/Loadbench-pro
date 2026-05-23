import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
} from '@/lib/auth/workspace';
import { publishedLoadRowDraftUpdateSchema } from '@/lib/validation/publishedDataReview';

export const dynamic = 'force-dynamic';

// PATCH /api/published-data-review/rows/[id]
// Update a row draft. Setting status=VERIFIED stamps verifiedById/verifiedAt
// to mark that a workspace member has reviewed it against the original
// published document. Verification here does NOT make the row authoritative
// load data — it only flags the transcription as reviewed.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = publishedLoadRowDraftUpdateSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existing = await prisma.publishedLoadRowDraft.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const nextStatus = data.status ?? existing.status;
  const becameVerified =
    data.status === 'VERIFIED' && existing.status !== 'VERIFIED';
  const leftVerified =
    data.status != null &&
    data.status !== 'VERIFIED' &&
    existing.status === 'VERIFIED';

  const updated = await prisma.publishedLoadRowDraft.update({
    where: { id: existing.id },
    data: {
      ...(data.pageLabel !== undefined ? { pageLabel: data.pageLabel } : {}),
      ...(data.bulletWeightGr !== undefined
        ? { bulletWeightGr: data.bulletWeightGr }
        : {}),
      ...(data.bulletName !== undefined ? { bulletName: data.bulletName } : {}),
      ...(data.powderName !== undefined ? { powderName: data.powderName } : {}),
      ...(data.chargeGr !== undefined ? { chargeGr: data.chargeGr } : {}),
      ...(data.velocityFps !== undefined
        ? { velocityFps: data.velocityFps }
        : {}),
      ...(data.isMaxLoad !== undefined ? { isMaxLoad: data.isMaxLoad } : {}),
      ...(data.colIn !== undefined ? { colIn: data.colIn } : {}),
      ...(data.bcG1 !== undefined ? { bcG1: data.bcG1 } : {}),
      ...(data.bcG7 !== undefined ? { bcG7: data.bcG7 } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      status: nextStatus,
      ...(becameVerified
        ? { verifiedById: ctx.userId, verifiedAt: new Date() }
        : {}),
      ...(leftVerified ? { verifiedById: null, verifiedAt: null } : {}),
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/published-data-review/rows/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const existing = await prisma.publishedLoadRowDraft.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  await prisma.publishedLoadRowDraft.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
