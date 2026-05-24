/**
 * Server-only helpers that bridge the validation harness to Prisma.
 *
 * These functions are NEVER exposed directly to users. They are called by
 * admin-only API routes after the caller has been verified via
 * `getAdminContext()` and a workspace context.
 */

import { prisma } from '@/lib/db/prisma';
import {
  getAdapter,
  type AdapterValidationMetadata,
  findForbiddenKeys,
} from '@/lib/ballistics/modelAdapter';
import {
  runValidationHarness,
  type CaseCreateInput,
  type DatasetCreateInput,
  type HarnessRunResult,
  type ValidationCaseInput,
} from '@/lib/validation/modelValidation';

export async function createDataset(
  workspaceId: string,
  userId: string | null,
  input: DatasetCreateInput,
) {
  return prisma.modelValidationDataset.create({
    data: {
      workspaceId,
      name: input.name,
      kind: input.kind.toUpperCase() as
        | 'PUBLISHED'
        | 'MANUFACTURER'
        | 'LAB'
        | 'INTERNAL_TEST',
      description: input.description ?? null,
      referenceIdentifier: input.referenceIdentifier ?? null,
      licenseNote: input.licenseNote ?? null,
      acknowledgedValidationOnly: input.acknowledgedValidationOnly,
      createdById: userId,
    },
  });
}

export async function listDatasets(workspaceId: string) {
  return prisma.modelValidationDataset.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { cases: true, runs: true } },
    },
  });
}

export async function getDataset(workspaceId: string, datasetId: string) {
  return prisma.modelValidationDataset.findFirst({
    where: { id: datasetId, workspaceId },
    include: {
      cases: { orderBy: { createdAt: 'asc' } },
      runs: { orderBy: { createdAt: 'desc' }, take: 25 },
    },
  });
}

export async function createCase(
  workspaceId: string,
  userId: string | null,
  input: CaseCreateInput,
) {
  // Reject if anything that smells like a forbidden output key has been
  // smuggled into the case payload (e.g. someone tried to attach
  // `predictedPressurePsi` to a case row).
  const forbidden = findForbiddenKeys(input);
  if (forbidden.length > 0) {
    throw new Error(
      `FORBIDDEN_FIELDS:${forbidden.join(',')}: cases must not contain ` +
        'predicted pressure, charge advice, or safe/unsafe verdicts. ' +
        'Reference pressure (admin metadata) lives only on ' +
        'referencePressurePsi.',
    );
  }
  // Confirm dataset belongs to the workspace before writing.
  const dataset = await prisma.modelValidationDataset.findFirst({
    where: { id: input.datasetId, workspaceId },
    select: { id: true },
  });
  if (!dataset) throw new Error('NOT_FOUND: dataset');

  return prisma.modelValidationCase.create({
    data: {
      workspaceId,
      datasetId: input.datasetId,
      label: input.label,
      cartridgeName: input.cartridgeName ?? null,
      bulletWeightGr: input.bulletWeightGr ?? null,
      bulletDiameterIn: input.bulletDiameterIn ?? null,
      chargeGr: input.chargeGr ?? null,
      caseCapacityGrH2O: input.caseCapacityGrH2O ?? null,
      barrelLengthIn: input.barrelLengthIn ?? null,
      twistRate: input.twistRate ?? null,
      cartridgeOalIn: input.cartridgeOalIn ?? null,
      powderBurnRateLabel: input.powderBurnRateLabel ?? null,
      tempF: input.tempF ?? null,
      referenceVelocityFps: input.referenceVelocityFps ?? null,
      referencePressurePsi:
        typeof input.referencePressurePsi === 'number'
          ? Math.round(input.referencePressurePsi)
          : null,
      observedVelocityFps: input.observedVelocityFps ?? null,
      pageLabel: input.pageLabel ?? null,
      notes: input.notes ?? null,
      createdById: userId,
    },
  });
}

export async function runDatasetValidation(args: {
  workspaceId: string;
  userId: string | null;
  datasetId: string;
  adapterName: string;
  modelVersionId?: string | null;
  notes?: string | null;
  toleranceFps?: number;
}): Promise<{ runId: string; result: HarnessRunResult }> {
  const dataset = await prisma.modelValidationDataset.findFirst({
    where: { id: args.datasetId, workspaceId: args.workspaceId },
    include: { cases: true },
  });
  if (!dataset) throw new Error('NOT_FOUND: dataset');

  const adapter = getAdapter(args.adapterName);

  const cases: ValidationCaseInput[] = dataset.cases.map((c) => ({
    id: c.id,
    label: c.label,
    cartridgeName: c.cartridgeName,
    bulletWeightGr: c.bulletWeightGr,
    bulletDiameterIn: c.bulletDiameterIn,
    chargeGr: c.chargeGr,
    caseCapacityGrH2O: c.caseCapacityGrH2O,
    barrelLengthIn: c.barrelLengthIn,
    twistRate: c.twistRate,
    cartridgeOalIn: c.cartridgeOalIn,
    powderBurnRateLabel: c.powderBurnRateLabel,
    tempF: c.tempF,
    referenceVelocityFps: c.referenceVelocityFps,
    referencePressurePsi: c.referencePressurePsi,
    observedVelocityFps: c.observedVelocityFps,
  }));

  const result = runValidationHarness({
    workspaceId: args.workspaceId,
    datasetId: args.datasetId,
    cases,
    adapter,
    toleranceFps: args.toleranceFps,
  });

  // Defence-in-depth: scan the assembled run payload one more time and force-
  // tag any forbidden keys found into the rejected-keys column.
  const sweepKeys = findForbiddenKeys(result);
  const rejectedKeys = Array.from(
    new Set([
      ...sweepKeys,
      ...result.caseResults.flatMap((r) => r.guardrailRejectedKeys),
    ]),
  );

  const adapterMeta: AdapterValidationMetadata | null = result.adapterMetadata;

  const row = await prisma.modelValidationRun.create({
    data: {
      workspaceId: args.workspaceId,
      datasetId: args.datasetId,
      adapterName: args.adapterName,
      adapterVersion: adapterMeta?.adapterVersion ?? adapter.version,
      modelVersionId: args.modelVersionId ?? null,
      status: result.status,
      pressurePredictionStatus: result.summary.pressurePredictionStatus,
      summaryJson: JSON.stringify(result.summary),
      caseResultsJson: JSON.stringify(result.caseResults),
      rejectedForbiddenKeysJson:
        rejectedKeys.length > 0 ? JSON.stringify(rejectedKeys) : null,
      notes: args.notes ?? null,
      acknowledgedValidationOnly: true,
      createdById: args.userId,
    },
  });

  return { runId: row.id, result };
}

export async function getRun(workspaceId: string, runId: string) {
  return prisma.modelValidationRun.findFirst({
    where: { id: runId, workspaceId },
    include: { dataset: { select: { id: true, name: true } } },
  });
}
