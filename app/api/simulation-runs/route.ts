import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import {
  simulationRunInputSchema,
  computeSimulationMetrics,
  hasForbiddenKeys,
  ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
  FORBIDDEN_KEYS_MESSAGE,
  type SimulationInputsSnapshot,
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
        select: {
          id: true,
          date: true,
          avgVelocityFps: true,
          esFps: true,
          sdFps: true,
          shotsFired: true,
        },
      },
      publishedRow: {
        select: {
          id: true,
          bulletName: true,
          powderName: true,
          chargeGr: true,
          velocityFps: true,
          pageLabel: true,
          status: true,
        },
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
    select: { id: true, name: true, status: true },
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

  let validationRecord:
    | {
        id: string;
        referenceLabel: string;
        referenceVelocityFps: number | null;
        measuredVelocityFps: number | null;
        referencePressurePsi: number | null;
      }
    | null = null;
  if (data.validationRecordId) {
    validationRecord = await prisma.pressureValidationRecord.findFirst({
      where: {
        id: data.validationRecordId,
        workspaceId: ctx.workspaceId,
      },
      select: {
        id: true,
        referenceLabel: true,
        referenceVelocityFps: true,
        measuredVelocityFps: true,
        referencePressurePsi: true,
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

  let rangeSession:
    | {
        id: string;
        date: Date;
        avgVelocityFps: number | null;
        esFps: number | null;
        sdFps: number | null;
        shotsFired: number | null;
      }
    | null = null;
  if (data.rangeSessionId) {
    rangeSession = await prisma.rangeSession.findFirst({
      where: {
        id: data.rangeSessionId,
        workspaceId: ctx.workspaceId,
      },
      select: {
        id: true,
        date: true,
        avgVelocityFps: true,
        esFps: true,
        sdFps: true,
        shotsFired: true,
      },
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

  let load: { id: string; name: string } | null = null;
  if (data.loadId) {
    load = await prisma.load.findFirst({
      where: { id: data.loadId, workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
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

  let publishedRow:
    | {
        id: string;
        bulletName: string | null;
        powderName: string | null;
        chargeGr: number | null;
        velocityFps: number | null;
        pageLabel: string | null;
        status: 'DRAFT' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED';
      }
    | null = null;
  if (data.publishedRowId) {
    publishedRow = await prisma.publishedLoadRowDraft.findFirst({
      where: { id: data.publishedRowId, workspaceId: ctx.workspaceId },
      select: {
        id: true,
        bulletName: true,
        powderName: true,
        chargeGr: true,
        velocityFps: true,
        pageLabel: true,
        status: true,
      },
    });
    if (!publishedRow) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['publishedRowId'],
              code: 'INVALID_SHAPE',
              message: 'Referenced published row not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
    if (publishedRow.status !== 'VERIFIED') {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['publishedRowId'],
              code: 'INVALID_SHAPE',
              message:
                'Published row must be user-verified before it can drive a simulation comparison.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }

  // Velocity-only delta bookkeeping. Reference comes from the validation
  // record (user-entered published/lab value) or the verified published row.
  // Observed comes from either the validation record's measured value or
  // the range session avg.
  const referenceFromValidation = validationRecord?.referenceVelocityFps ?? null;
  const referenceFromPublishedRow = publishedRow?.velocityFps ?? null;
  let referenceFps: number | null = null;
  let referenceSource: SimulationInputsSnapshot['referenceSource'] = 'none';
  if (referenceFromValidation != null) {
    referenceFps = referenceFromValidation;
    referenceSource = 'validation-record';
  } else if (referenceFromPublishedRow != null) {
    referenceFps = referenceFromPublishedRow;
    referenceSource = 'published-row';
  }

  let observedFps: number | null = null;
  let observedSource: SimulationInputsSnapshot['observedSource'] = 'none';
  if (rangeSession?.avgVelocityFps != null) {
    observedFps = rangeSession.avgVelocityFps;
    observedSource = 'range-session';
  } else if (validationRecord?.measuredVelocityFps != null) {
    observedFps = validationRecord.measuredVelocityFps;
    observedSource = 'validation-record-measured';
  }

  const metrics = computeSimulationMetrics({
    referenceFps,
    observedFps,
    toleranceFps: data.toleranceFps ?? null,
    tolerancePct: data.tolerancePct ?? null,
    rangeSession: rangeSession
      ? {
          esFps: rangeSession.esFps,
          sdFps: rangeSession.sdFps,
          shotsFired: rangeSession.shotsFired,
        }
      : null,
    hasLinkedEntity: !!(load || validationRecord || publishedRow || rangeSession),
  });

  const inputsSnapshot: SimulationInputsSnapshot = {
    modelVersion: {
      id: modelVersion.id,
      name: modelVersion.name,
      status: modelVersion.status,
    },
    load: load,
    validationRecord: validationRecord,
    rangeSession: rangeSession
      ? {
          id: rangeSession.id,
          date: rangeSession.date.toISOString(),
          avgVelocityFps: rangeSession.avgVelocityFps,
          esFps: rangeSession.esFps,
          sdFps: rangeSession.sdFps,
          shotsFired: rangeSession.shotsFired,
        }
      : null,
    publishedRow: publishedRow,
    toleranceFps: data.toleranceFps ?? null,
    tolerancePct: data.tolerancePct ?? null,
    referenceFps,
    referenceSource,
    observedFps,
    observedSource,
  };

  const row = await prisma.simulationRun.create({
    data: {
      workspaceId: ctx.workspaceId,
      modelVersionId: data.modelVersionId,
      loadId: data.loadId ?? null,
      validationRecordId: data.validationRecordId ?? null,
      rangeSessionId: data.rangeSessionId ?? null,
      publishedRowId: data.publishedRowId ?? null,
      status: data.status,
      velocityDeltaFps: metrics.deltaFps,
      velocityDeltaPct: metrics.deltaPct,
      toleranceFps: data.toleranceFps ?? null,
      tolerancePct: data.tolerancePct ?? null,
      inputsSnapshotJson: JSON.stringify(inputsSnapshot),
      metricsJson: JSON.stringify(metrics),
      notes: data.notes ?? null,
      reviewerNotes: data.reviewerNotes ?? null,
      acknowledgedExperimental: data.acknowledgedExperimental,
      createdById: ctx.userId,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
