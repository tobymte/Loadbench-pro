import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { assertCanWrite, getWorkspaceContext } from '@/lib/auth/workspace';
import { publishedLoadRowDraftBatchInputSchema } from '@/lib/validation/publishedDataReview';

export const dynamic = 'force-dynamic';

// POST /api/published-data-review/rows/batch
// Stages multiple PublishedLoadRowDraft records under a chosen review set
// (PublishedDataImport). All rows are user transcriptions for verification —
// NOT recommendations, NOT authoritative load data. Rows are created with
// status NEEDS_REVIEW; the route refuses to mark any row VERIFIED here.
export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = publishedLoadRowDraftBatchInputSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Confirm the chosen import is in this workspace.
  const importRecord = await prisma.publishedDataImport.findFirst({
    where: { id: data.importId, workspaceId: ctx.workspaceId },
    select: { id: true, sourceId: true },
  });
  if (!importRecord) {
    return NextResponse.json(
      {
        error: 'INVALID',
        issues: [
          {
            path: ['importId'],
            code: 'INVALID_SHAPE',
            message: 'Import not found in this workspace.',
          },
        ],
      },
      { status: 400 },
    );
  }

  // Optional batch-level overrides must also belong to this workspace.
  const batchErrors: Array<{ path: string[]; code: string; message: string }> =
    [];
  if (data.sourceId) {
    const src = await prisma.source.findFirst({
      where: { id: data.sourceId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!src)
      batchErrors.push({
        path: ['sourceId'],
        code: 'INVALID_SHAPE',
        message: 'Source not found in this workspace.',
      });
  }
  if (data.cartridgeId) {
    const c = await prisma.cartridge.findFirst({
      where: { id: data.cartridgeId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!c)
      batchErrors.push({
        path: ['cartridgeId'],
        code: 'INVALID_SHAPE',
        message: 'Cartridge not found in this workspace.',
      });
  }
  if (batchErrors.length > 0) {
    return NextResponse.json(
      { error: 'INVALID', issues: batchErrors },
      { status: 400 },
    );
  }

  // Collect referenced component IDs and confirm they belong to this
  // workspace (and the right kind) in a single round-trip each.
  const bulletIds = Array.from(
    new Set(
      data.rows
        .map((r) => r.bulletComponentId)
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    ),
  );
  const powderIds = Array.from(
    new Set(
      data.rows
        .map((r) => r.powderComponentId)
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    ),
  );
  const [validBullets, validPowders] = await Promise.all([
    bulletIds.length === 0
      ? Promise.resolve([])
      : prisma.component.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            kind: 'BULLET',
            id: { in: bulletIds },
          },
          select: { id: true },
        }),
    powderIds.length === 0
      ? Promise.resolve([])
      : prisma.component.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            kind: 'POWDER',
            id: { in: powderIds },
          },
          select: { id: true },
        }),
  ]);
  const validBulletIds = new Set(validBullets.map((b) => b.id));
  const validPowderIds = new Set(validPowders.map((p) => p.id));

  const sourceId = data.sourceId ?? importRecord.sourceId ?? null;
  const baseCartridgeId = data.cartridgeId ?? null;

  // Per-row server-side validation. Out-of-workspace component refs are
  // dropped to free-text rather than rejected, so a single bad ref does not
  // discard the row's other valid fields.
  const rowErrors: Array<{
    rowIndex: number;
    issues: Array<{ field?: string; message: string }>;
  }> = [];

  const toCreate: Array<{
    rowIndex: number;
    payload: Prisma.PublishedLoadRowDraftCreateManyInput;
  }> = [];

  data.rows.forEach((r, i) => {
    const issues: Array<{ field?: string; message: string }> = [];
    // A row needs at least one of bullet/powder/charge to be meaningful.
    if (
      !r.bulletName &&
      !r.powderName &&
      !r.bulletComponentId &&
      !r.powderComponentId &&
      r.chargeGr == null
    ) {
      issues.push({
        message:
          'Row needs at least a bullet, powder, or charge value to stage.',
      });
    }

    const bulletComponentId =
      r.bulletComponentId && validBulletIds.has(r.bulletComponentId)
        ? r.bulletComponentId
        : null;
    const powderComponentId =
      r.powderComponentId && validPowderIds.has(r.powderComponentId)
        ? r.powderComponentId
        : null;

    if (issues.length > 0) {
      rowErrors.push({ rowIndex: i, issues });
      return;
    }

    toCreate.push({
      rowIndex: i,
      payload: {
        workspaceId: ctx.workspaceId,
        importId: importRecord.id,
        sourceId,
        cartridgeId: baseCartridgeId,
        bulletComponentId,
        powderComponentId,
        pageLabel: r.pageLabel ?? null,
        bulletWeightGr: r.bulletWeightGr ?? null,
        bulletName: r.bulletName ?? null,
        powderName: r.powderName ?? null,
        chargeGr: r.chargeGr ?? null,
        velocityFps: r.velocityFps ?? null,
        isMaxLoad: r.isMaxLoad ?? false,
        publishedMaxChargeGr: r.publishedMaxChargeGr ?? null,
        colIn: r.colIn ?? null,
        bcG1: r.bcG1 ?? null,
        bcG7: r.bcG7 ?? null,
        // Batch staging is review-only — rows never enter at VERIFIED.
        status: 'NEEDS_REVIEW',
        notes: r.notes ?? null,
      },
    });
  });

  let created = 0;
  if (toCreate.length > 0) {
    // createMany skips relations but we are only writing scalar FK IDs and
    // primitives, so it is safe and faster than serial creates.
    const result = await prisma.publishedLoadRowDraft.createMany({
      data: toCreate.map((c) => c.payload),
    });
    created = result.count;
  }

  return NextResponse.json(
    {
      created,
      total: data.rows.length,
      skipped: rowErrors.length,
      rowErrors,
    },
    { status: 201 },
  );
}
