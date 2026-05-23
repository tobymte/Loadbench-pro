import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

const patchInput = z.object({
  manufacturer: z.string().min(1).max(120).optional(),
  model: z.string().min(1).max(120).optional(),
  bulletWeightGr: z.number().positive().optional().nullable(),
  bulletBc: z.number().positive().optional().nullable(),
  burnRateLabel: z.string().max(60).optional().nullable(),
  lotNumber: z.string().max(60).optional().nullable(),
  quantityOnHand: z.number().min(0).optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  lowStockThreshold: z.number().min(0).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  archived: z.boolean().optional(),
});

const adjustmentInput = z.object({
  action: z.literal('adjust'),
  // Positive to add stock, negative to consume. Recordkeeping only.
  delta: z.number(),
});

const bodyInput = z.union([patchInput, adjustmentInput]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const existing = await prisma.component.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const parsed = bodyInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if ('action' in data) {
    const current = existing.quantityOnHand ?? 0;
    const next = Math.max(0, current + data.delta);
    const row = await prisma.component.update({
      where: { id: existing.id },
      data: { quantityOnHand: next },
    });
    return NextResponse.json(row);
  }

  const row = await prisma.component.update({
    where: { id: existing.id },
    data,
  });
  return NextResponse.json(row);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getWorkspaceContext();
  const row = await prisma.component.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
  });
  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(row);
}
