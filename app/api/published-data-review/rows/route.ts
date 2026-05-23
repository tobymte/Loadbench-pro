import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { publishedLoadRowDraftInputSchema } from '@/lib/validation/publishedDataReview';

export const dynamic = 'force-dynamic';

// GET /api/published-data-review/rows
// Lists staged row drafts in the workspace. These rows are NOT operational
// loads; they require user verification against the original published
// document before they can be cited on a Load.
export async function GET(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  const url = new URL(req.url);
  const importId = url.searchParams.get('importId') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;

  const rows = await prisma.publishedLoadRowDraft.findMany({
    where: scopeToWorkspace(ctx, {
      ...(importId ? { importId } : {}),
      ...(status
        ? {
            status: status as
              | 'DRAFT'
              | 'NEEDS_REVIEW'
              | 'VERIFIED'
              | 'REJECTED',
          }
        : {}),
    }),
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      source: { select: { id: true, title: true } },
      import: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json({ data: rows });
}

// POST /api/published-data-review/rows
// Stages a row draft. Charges/velocities here are user-entered transcriptions
// for review. They are NOT recommendations and NOT used as authoritative load
// data anywhere in the app.
export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = publishedLoadRowDraftInputSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

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

  const row = await prisma.publishedLoadRowDraft.create({
    data: {
      workspaceId: ctx.workspaceId,
      importId: importRecord.id,
      sourceId: data.sourceId ?? importRecord.sourceId ?? null,
      cartridgeId: data.cartridgeId ?? null,
      bulletComponentId: data.bulletComponentId ?? null,
      powderComponentId: data.powderComponentId ?? null,
      pageLabel: data.pageLabel ?? null,
      bulletWeightGr: data.bulletWeightGr ?? null,
      bulletName: data.bulletName ?? null,
      powderName: data.powderName ?? null,
      chargeGr: data.chargeGr ?? null,
      velocityFps: data.velocityFps ?? null,
      isMaxLoad: data.isMaxLoad ?? false,
      colIn: data.colIn ?? null,
      bcG1: data.bcG1 ?? null,
      bcG7: data.bcG7 ?? null,
      status: data.status ?? 'DRAFT',
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(row, { status: 201 });
}
