import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { bulletDimensionRecordInputSchema } from '@/lib/validation/solverInputs';
import { assertReferencesInWorkspace } from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.bulletDimensionRecord.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      component: {
        select: { id: true, manufacturer: true, model: true },
      },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = bulletDimensionRecordInputSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const fkError = await assertReferencesInWorkspace(ctx.workspaceId, [
    { field: 'componentId', id: data.componentId, table: 'component' },
  ]);
  if (fkError) return fkError;

  const row = await prisma.bulletDimensionRecord.create({
    data: {
      workspaceId: ctx.workspaceId,
      componentId: data.componentId ?? null,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      lotNumber: data.lotNumber ?? null,
      weightGr: data.weightGr ?? null,
      diameterIn: data.diameterIn ?? null,
      lengthIn: data.lengthIn ?? null,
      bearingSurfaceIn: data.bearingSurfaceIn ?? null,
      boatTailLengthIn: data.boatTailLengthIn ?? null,
      ogiveStyle: data.ogiveStyle ?? null,
      bcG1: data.bcG1 ?? null,
      bcG7: data.bcG7 ?? null,
      sampleCount: data.sampleCount ?? null,
      notes: data.notes ?? null,
      createdById: ctx.userId,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
