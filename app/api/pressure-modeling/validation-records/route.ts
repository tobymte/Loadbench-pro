import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import {
  pressureValidationRecordInputSchema,
  ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
} from '@/lib/validation/pressureModeling';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.pressureValidationRecord.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      load: { select: { id: true, name: true } },
      source: { select: { id: true, title: true } },
      modelVersion: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = pressureValidationRecordInputSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (!data.acknowledged) {
    return NextResponse.json(
      {
        error: 'INVALID',
        issues: [
          {
            path: ['acknowledged'],
            code: 'ACKNOWLEDGEMENT_REQUIRED',
            message: ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
          },
        ],
      },
      { status: 400 },
    );
  }

  // Validate referenced entities (if any) belong to this workspace.
  if (data.loadId) {
    const exists = await prisma.load.findFirst({
      where: { id: data.loadId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['loadId'],
              code: 'INVALID_SHAPE',
              message: 'Referenced load not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }
  if (data.sourceId) {
    const exists = await prisma.source.findFirst({
      where: { id: data.sourceId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['sourceId'],
              code: 'INVALID_SHAPE',
              message: 'Referenced source not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }
  if (data.modelVersionId) {
    const exists = await prisma.pressureModelVersion.findFirst({
      where: { id: data.modelVersionId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['modelVersionId'],
              code: 'INVALID_SHAPE',
              message: 'Referenced model version not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }

  const row = await prisma.pressureValidationRecord.create({
    data: {
      workspaceId: ctx.workspaceId,
      loadId: data.loadId ?? null,
      sourceId: data.sourceId ?? null,
      modelVersionId: data.modelVersionId ?? null,
      referenceLabel: data.referenceLabel,
      referencePressurePsi: data.referencePressurePsi ?? null,
      referenceVelocityFps: data.referenceVelocityFps ?? null,
      measuredVelocityFps: data.measuredVelocityFps ?? null,
      conditionsJson: data.conditionsJson ?? null,
      status: data.status,
      notes: data.notes ?? null,
      acknowledged: data.acknowledged,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
