import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { powderMetadataRecordInputSchema } from '@/lib/validation/solverInputs';
import { assertReferencesInWorkspace } from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.powderMetadataRecord.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      component: {
        select: { id: true, manufacturer: true, model: true },
      },
      source: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = powderMetadataRecordInputSchema.safeParse(
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
    { field: 'sourceId', id: data.sourceId, table: 'source' },
  ]);
  if (fkError) return fkError;

  const row = await prisma.powderMetadataRecord.create({
    data: {
      workspaceId: ctx.workspaceId,
      componentId: data.componentId ?? null,
      manufacturer: data.manufacturer ?? null,
      powderName: data.powderName ?? null,
      lotNumber: data.lotNumber ?? null,
      burnRateLabel: data.burnRateLabel ?? null,
      densityGcc: data.densityGcc ?? null,
      bulkDensityGrPerCc: data.bulkDensityGrPerCc ?? null,
      kernelShape: data.kernelShape ?? null,
      tempSensitivityNotes: data.tempSensitivityNotes ?? null,
      sourceId: data.sourceId ?? null,
      notes: data.notes ?? null,
      createdById: ctx.userId,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
