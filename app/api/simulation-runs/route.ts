import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import {
  simulationRunInputSchema,
  computeVelocityDelta,
  hasForbiddenKeys,
  ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
  FORBIDDEN_KEYS_MESSAGE,
} from '@/lib/validation/simulationRun';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.simulationRun.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      modelVersion: { select: { id: true, name: true, status: true } },
      load: { select: { id: true, name: true } },
      validationRecord: {
        select: {
          id: true,
          referenceLabel: true,
          referenceVelocityFps: true,
          measuredVelocityFps: true,
          referencePressurePsi: true,
        },
      },
      rangeSession: {
        select: { id: true, date: true, avgVelocityFps: true },
      },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const rawBody = (await req.json().catch(() => ({}))) as unknown;

  // Reject any body that includes a forbidden key implying pressure
  // prediction or load advice — before anything else.
  const forbidden = hasForbiddenKeys(rawBody);
  if (forbidden.length > 0) {
    return NextResponse.json(
      {
        error: 'FORBIDDEN_FIELDS',
        forbiddenKeys: forbidden,
        issues: forbidden.map((key) => ({
          path: [key],
          code: 'FORBIDDEN_FIELD',
          message: FORBIDDEN_KEYS_MESSAGE,
        })),
      },
      { status: 400 },
    );
  }

  const parsed = simulationRunInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (!data.acknowledgedExperimental) {
    return NextResponse.json(
      {
        error: 'INVALID',
        issues: [
          {
            path: ['acknowledgedExperimental'],
            code: 'ACKNOWLEDGEMENT_REQUIRED',
            message: ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
          },
        ],
      },
      { status: 400 },
    );
  }

  // Verify all referenced entities belong to this workspace.
  const modelVersion = await prisma.pressureModelVersion.findFirst({
    where: { id: data.modelVersionId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!modelVersion) {
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

  let validationRecord: {
    id: string;
    referenceVelocityFps: number | null;
    measuredVelocityFps: number | null;
  } | null = null;
  if (data.validationRecordId) {
    validationRecord = await prisma.pressureValidationRecord.findFirst({
      where: {
        id: data.validationRecordId,
        workspaceId: ctx.workspaceId,
      },
      select: {
        id: true,
        referenceVelocityFps: true,
        measuredVelocityFps: true,
      },
    });
    if (!validationRecord) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['validationRecordId'],
              code: 'INVALID_SHAPE',
              message:
                'Referenced validation record not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }

  let rangeSession: { id: string; avgVelocityFps: number | null } | null = null;
  if (data.rangeSessionId) {
    rangeSession = await prisma.rangeSession.findFirst({
      where: {
        id: data.rangeSessionId,
        workspaceId: ctx.workspaceId,
      },
      select: { id: true, avgVelocityFps: true },
    });
    if (!rangeSession) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['rangeSessionId'],
              code: 'INVALID_SHAPE',
              message: 'Referenced range session not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }

  if (data.loadId) {
    const load = await prisma.load.findFirst({
      where: { id: data.loadId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!load) {
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

  // Velocity-only delta bookkeeping. Reference comes from the validation
  // record (user-entered published/lab value), observed comes from either
  // the validation record's measured value or the range session avg.
  const referenceFps = validationRecord?.referenceVelocityFps ?? null;
  const observedFps =
    rangeSession?.avgVelocityFps ??
    validationRecord?.measuredVelocityFps ??
    null;
  const { deltaFps, deltaPct } = computeVelocityDelta(referenceFps, observedFps);

  const row = await prisma.simulationRun.create({
    data: {
      workspaceId: ctx.workspaceId,
      modelVersionId: data.modelVersionId,
      loadId: data.loadId ?? null,
      validationRecordId: data.validationRecordId ?? null,
      rangeSessionId: data.rangeSessionId ?? null,
      status: data.status,
      velocityDeltaFps: deltaFps,
      velocityDeltaPct: deltaPct,
      toleranceFps: data.toleranceFps ?? null,
      tolerancePct: data.tolerancePct ?? null,
      notes: data.notes ?? null,
      reviewerNotes: data.reviewerNotes ?? null,
      acknowledgedExperimental: data.acknowledgedExperimental,
      createdById: ctx.userId,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
