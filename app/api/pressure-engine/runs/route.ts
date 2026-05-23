/**
 * Pressure engine — non-operational runner endpoint.
 *
 * POST creates a PressureEngineRun audit row. The runner never emits PSI,
 * peak pressure, charge advice, or safe/unsafe verdicts. The forbidden-key
 * guardrail rejects any input body that contains those keys, and strips
 * them from any candidate output before persistence.
 *
 * GET lists prior runs for the workspace, most-recent first, for the
 * history/audit view on the Pressure Engine page.
 *
 * Both methods require an active pressure_modeling entitlement on the
 * workspace. Without one, this route returns 402.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { FEATURE_KEYS, hasPremiumAccess } from '@/lib/billing/entitlements';
import {
  ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
  FORBIDDEN_OUTPUT_KEYS_MESSAGE,
  findForbiddenKeys,
  pressureEngineRunRequestSchema,
  runPressureEngine,
  stripForbiddenKeys,
  type EngineInputsSnapshot,
} from '@/lib/validation/pressureEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const hasAccess = await hasPremiumAccess(
    ctx.workspaceId,
    FEATURE_KEYS.PRESSURE_MODELING,
  );
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'PAYMENT_REQUIRED', featureKey: FEATURE_KEYS.PRESSURE_MODELING },
      { status: 402 },
    );
  }

  const rows = await prisma.pressureEngineRun.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      modelVersion: { select: { id: true, name: true, status: true } },
      load: { select: { id: true, name: true } },
      rangeSession: {
        select: { id: true, date: true, avgVelocityFps: true },
      },
      validationRecord: {
        select: { id: true, referenceLabel: true },
      },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const hasAccess = await hasPremiumAccess(
    ctx.workspaceId,
    FEATURE_KEYS.PRESSURE_MODELING,
  );
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'PAYMENT_REQUIRED', featureKey: FEATURE_KEYS.PRESSURE_MODELING },
      { status: 402 },
    );
  }

  const rawBody = (await req.json().catch(() => ({}))) as unknown;

  // Hard guardrail: reject any forbidden keys before anything else, at any
  // depth in the request body. We don't silently drop them — the caller
  // must remove them and retry, so misbehaviour is visible.
  const forbidden = findForbiddenKeys(rawBody);
  if (forbidden.length > 0) {
    // Persist a REJECTED_BY_GUARDRAIL audit row so the rejection is part of
    // the history view. Best-effort — failure to write the audit row must
    // not turn into a successful response.
    try {
      await prisma.pressureEngineRun.create({
        data: {
          workspaceId: ctx.workspaceId,
          status: 'REJECTED_BY_GUARDRAIL',
          pressurePredictionStatus: 'disabled',
          inputsSnapshotJson: null,
          outputsJson: JSON.stringify({
            rejectedForbiddenKeys: forbidden,
            reason: FORBIDDEN_OUTPUT_KEYS_MESSAGE,
          }),
          acknowledgedExperimental: false,
          createdById: ctx.userId,
        },
      });
    } catch {
      // swallow — the guardrail response below is what matters.
    }
    return NextResponse.json(
      {
        error: 'FORBIDDEN_FIELDS',
        forbiddenKeys: forbidden,
        message: FORBIDDEN_OUTPUT_KEYS_MESSAGE,
      },
      { status: 400 },
    );
  }

  const parsed = pressureEngineRunRequestSchema.safeParse(rawBody);
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

  // Resolve workspace-scoped references. Each is optional; the runner
  // assembles a completeness score from what's present.
  let modelVersion: EngineInputsSnapshot['modelVersion'] = null;
  if (data.modelVersionId) {
    const m = await prisma.pressureModelVersion.findFirst({
      where: { id: data.modelVersionId, workspaceId: ctx.workspaceId },
      select: {
        id: true,
        name: true,
        status: true,
        governanceStatus: true,
      },
    });
    if (!m) {
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
    modelVersion = m;
  }

  let load: EngineInputsSnapshot['load'] = null;
  if (data.loadId) {
    const l = await prisma.load.findFirst({
      where: { id: data.loadId, workspaceId: ctx.workspaceId },
      select: {
        id: true,
        name: true,
        cartridgeId: true,
        powderId: true,
        bulletId: true,
        chargeGr: true,
        cartridgeOalIn: true,
        safetyAcknowledged: true,
      },
    });
    if (!l) {
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
    load = l;
  }

  let rangeSession: EngineInputsSnapshot['rangeSession'] = null;
  if (data.rangeSessionId) {
    const s = await prisma.rangeSession.findFirst({
      where: { id: data.rangeSessionId, workspaceId: ctx.workspaceId },
      select: {
        id: true,
        date: true,
        avgVelocityFps: true,
        esFps: true,
        sdFps: true,
        shotsFired: true,
      },
    });
    if (!s) {
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
    rangeSession = {
      id: s.id,
      date: s.date.toISOString(),
      avgVelocityFps: s.avgVelocityFps,
      esFps: s.esFps,
      sdFps: s.sdFps,
      shotsFired: s.shotsFired,
    };
  }

  let validationRecord: EngineInputsSnapshot['validationRecord'] = null;
  if (data.validationRecordId) {
    const v = await prisma.pressureValidationRecord.findFirst({
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
    if (!v) {
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
    validationRecord = v;
  }

  const [
    caseCapacity,
    bulletDimensions,
    powderMetadata,
    barrelGeometry,
    chronoCalibration,
  ] = await Promise.all([
    prisma.caseCapacityMeasurement.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.bulletDimensionRecord.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.powderMetadataRecord.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.barrelGeometryRecord.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.chronoCalibrationRecord.count({ where: { workspaceId: ctx.workspaceId } }),
  ]);

  const { inputs, outputs, status } = runPressureEngine({
    modelVersion,
    load,
    rangeSession,
    validationRecord,
    solverInputCounts: {
      caseCapacity,
      bulletDimensions,
      powderMetadata,
      barrelGeometry,
      chronoCalibration,
    },
  });

  // Hard outbound guard. The runner already strips forbidden keys, but we
  // re-strip here as a belt-and-braces check against any future change.
  const safeOutputs = stripForbiddenKeys(outputs);

  const row = await prisma.pressureEngineRun.create({
    data: {
      workspaceId: ctx.workspaceId,
      modelVersionId: data.modelVersionId ?? null,
      loadId: data.loadId ?? null,
      rangeSessionId: data.rangeSessionId ?? null,
      validationRecordId: data.validationRecordId ?? null,
      status,
      pressurePredictionStatus: 'disabled',
      inputsSnapshotJson: JSON.stringify(inputs),
      outputsJson: JSON.stringify(safeOutputs),
      velocityDeltaFps: safeOutputs.velocityDeltaFps,
      velocityDeltaPct: safeOutputs.velocityDeltaPct,
      notes: data.notes ?? null,
      acknowledgedExperimental: data.acknowledgedExperimental,
      createdById: ctx.userId,
    },
  });

  return NextResponse.json(
    {
      id: row.id,
      status: row.status,
      pressurePredictionStatus: row.pressurePredictionStatus,
      outputs: safeOutputs,
    },
    { status: 201 },
  );
}
