import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';
import { pressureModelVersionInputSchema } from '@/lib/validation/pressureModeling';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.pressureModelVersion.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = pressureModelVersionInputSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const row = await prisma.pressureModelVersion.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      notes: data.notes ?? null,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
