import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { validateLoad } from '@/lib/validation/load';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.load.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      cartridge: { select: { name: true } },
      bullet: { select: { manufacturer: true, model: true } },
      powder: { select: { manufacturer: true, model: true } },
      source: { select: { title: true, publishedMaxGr: true } },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const body = await req.json().catch(() => ({}));

  // Resolve cited source (if any) for charge-vs-published-max validation.
  let source: { id: string; publishedMaxGr: number | null } | null = null;
  if (typeof body?.sourceId === 'string' && body.sourceId) {
    source = await prisma.source.findFirst({
      where: { id: body.sourceId, workspaceId: ctx.workspaceId },
      select: { id: true, publishedMaxGr: true },
    });
    if (!source) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              field: 'sourceId',
              code: 'INVALID_SHAPE',
              message: 'Cited Source not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }

  const result = validateLoad(body, source);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'INVALID', issues: result.issues },
      { status: 400 },
    );
  }

  const data = result.data;

  // Sanity: required references must exist in the workspace before creating
  // the load. This protects the FK relations and avoids cross-workspace bleed.
  const [cartridge, bullet, powder] = await Promise.all([
    prisma.cartridge.findFirst({
      where: { id: data.cartridgeId, workspaceId: ctx.workspaceId },
      select: { id: true },
    }),
    prisma.component.findFirst({
      where: { id: data.bulletId, workspaceId: ctx.workspaceId, kind: 'BULLET' },
      select: { id: true },
    }),
    prisma.component.findFirst({
      where: { id: data.powderId, workspaceId: ctx.workspaceId, kind: 'POWDER' },
      select: { id: true },
    }),
  ]);

  if (!cartridge || !bullet || !powder) {
    return NextResponse.json(
      {
        error: 'INVALID',
        issues: [
          {
            code: 'INVALID_SHAPE',
            message:
              'Cartridge, bullet, and powder must all exist in this workspace.',
          },
        ],
      },
      { status: 400 },
    );
  }

  const row = await prisma.load.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      updatedById: ctx.userId,
      name: data.name,
      status: data.status,
      cartridgeId: data.cartridgeId,
      bulletId: data.bulletId,
      powderId: data.powderId,
      primerId: data.primerId ?? null,
      caseId: data.caseId ?? null,
      rifleId: data.rifleId ?? null,
      sourceId: data.sourceId ?? null,
      chargeGr: data.chargeGr ?? null,
      cartridgeOalIn: data.cartridgeOalIn ?? null,
      cartridgeBaseToOgiveIn: data.cartridgeBaseToOgiveIn ?? null,
      caseTrimLengthIn: data.caseTrimLengthIn ?? null,
      neckTensionThou: data.neckTensionThou ?? null,
      publishedMaxChargeGr: data.publishedMaxChargeGr ?? null,
      publishedDataRowId: data.publishedDataRowId ?? null,
      sourcePageLabel: data.sourcePageLabel ?? null,
      safetyAcknowledged: data.safetyAcknowledged,
      safetyNotes: data.safetyNotes ?? null,
      notes: data.notes ?? null,
    },
  });

  // TODO(audit): write an AuditEvent capturing the created snapshot.
  return NextResponse.json(row, { status: 201 });
}
