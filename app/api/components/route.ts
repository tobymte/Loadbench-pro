import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

const componentInput = z.object({
  kind: z.enum(['BULLET', 'POWDER', 'PRIMER', 'CASE']),
  manufacturer: z.string().min(1).max(120),
  model: z.string().min(1).max(120),
  bulletWeightGr: z.number().positive().optional().nullable(),
  bulletBc: z.number().positive().optional().nullable(),
  burnRateLabel: z.string().max(60).optional().nullable(),
  lotNumber: z.string().max(60).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') as
    | 'BULLET'
    | 'POWDER'
    | 'PRIMER'
    | 'CASE'
    | null;

  const rows = await prisma.component.findMany({
    where: scopeToWorkspace(ctx, kind ? { kind } : {}),
    orderBy: [{ kind: 'asc' }, { manufacturer: 'asc' }, { model: 'asc' }],
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = componentInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const row = await prisma.component.create({
    data: { ...parsed.data, workspaceId: ctx.workspaceId },
  });

  // TODO(audit): record AuditEvent
  return NextResponse.json(row, { status: 201 });
}
