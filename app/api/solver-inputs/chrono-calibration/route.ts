import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { chronoCalibrationRecordInputSchema } from '@/lib/validation/solverInputs';
import { assertReferencesInWorkspace } from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.chronoCalibrationRecord.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      referenceLoad: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = chronoCalibrationRecordInputSchema.safeParse(
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
    { field: 'referenceLoadId', id: data.referenceLoadId, table: 'load' },
  ]);
  if (fkError) return fkError;

  const row = await prisma.chronoCalibrationRecord.create({
    data: {
      workspaceId: ctx.workspaceId,
      deviceName: data.deviceName ?? null,
      deviceType: data.deviceType ?? null,
      serialNumber: data.serialNumber ?? null,
      firmwareVersion: data.firmwareVersion ?? null,
      calibrationDate: data.calibrationDate
        ? new Date(data.calibrationDate)
        : null,
      referenceLoadId: data.referenceLoadId ?? null,
      referenceVelocityFps: data.referenceVelocityFps ?? null,
      observedVelocityFps: data.observedVelocityFps ?? null,
      offsetFps: data.offsetFps ?? null,
      conditionsJson: data.conditionsJson ?? null,
      notes: data.notes ?? null,
      createdById: ctx.userId,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
