import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { barrelGeometryRecordInputSchema } from '@/lib/validation/solverInputs';
import { assertReferencesInWorkspace } from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.barrelGeometryRecord.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      rifle: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = barrelGeometryRecordInputSchema.safeParse(
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
    { field: 'rifleId', id: data.rifleId, table: 'rifle' },
  ]);
  if (fkError) return fkError;

  const row = await prisma.barrelGeometryRecord.create({
    data: {
      workspaceId: ctx.workspaceId,
      rifleId: data.rifleId ?? null,
      name: data.name ?? null,
      barrelLengthIn: data.barrelLengthIn ?? null,
      twistRate: data.twistRate ?? null,
      boreDiameterIn: data.boreDiameterIn ?? null,
      grooveDiameterIn: data.grooveDiameterIn ?? null,
      chamberNotes: data.chamberNotes ?? null,
      throatLengthIn: data.throatLengthIn ?? null,
      freeboreIn: data.freeboreIn ?? null,
      landCount: data.landCount ?? null,
      notes: data.notes ?? null,
      createdById: ctx.userId,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
