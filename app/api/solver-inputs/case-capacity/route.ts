import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { caseCapacityMeasurementInputSchema } from '@/lib/validation/solverInputs';
import { assertReferencesInWorkspace } from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.caseCapacityMeasurement.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      cartridge: { select: { id: true, name: true } },
      load: { select: { id: true, name: true } },
      brassComponent: {
        select: { id: true, manufacturer: true, model: true },
      },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = caseCapacityMeasurementInputSchema.safeParse(
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
    { field: 'cartridgeId', id: data.cartridgeId, table: 'cartridge' },
    { field: 'loadId', id: data.loadId, table: 'load' },
    {
      field: 'brassComponentId',
      id: data.brassComponentId,
      table: 'component',
    },
  ]);
  if (fkError) return fkError;

  const row = await prisma.caseCapacityMeasurement.create({
    data: {
      workspaceId: ctx.workspaceId,
      cartridgeId: data.cartridgeId ?? null,
      loadId: data.loadId ?? null,
      brassComponentId: data.brassComponentId ?? null,
      lotNumber: data.lotNumber ?? null,
      method: data.method ?? null,
      firedOrResized: data.firedOrResized ?? null,
      waterCapacityGr: data.waterCapacityGr ?? null,
      sampleCount: data.sampleCount ?? null,
      avgCapacityGr: data.avgCapacityGr ?? null,
      sdCapacityGr: data.sdCapacityGr ?? null,
      tempF: data.tempF ?? null,
      notes: data.notes ?? null,
      createdById: ctx.userId,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
