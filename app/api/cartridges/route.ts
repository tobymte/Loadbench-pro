import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

const cartridgeInput = z.object({
  name: z.string().min(1).max(120),
  saami: z.string().max(120).optional().nullable(),
  caseCapacityGrH2O: z.number().positive().optional().nullable(),
  maxPressurePsi: z.number().int().positive().optional().nullable(),
  bulletDiameterIn: z.number().positive().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.cartridge.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = cartridgeInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const row = await prisma.cartridge.create({
      data: { ...parsed.data, workspaceId: ctx.workspaceId },
    });
    // TODO(audit): write AuditEvent { entityType: 'Cartridge', entityId, action: 'create' }
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return NextResponse.json(
        {
          error: 'DUPLICATE',
          issues: [
            {
              path: ['name'],
              code: 'DUPLICATE',
              message: 'A cartridge with this name already exists in your workspace.',
            },
          ],
        },
        { status: 409 },
      );
    }
    throw err;
  }
}
