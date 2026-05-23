import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

const rifleInput = z.object({
  name: z.string().min(1).max(120),
  manufacturer: z.string().max(120).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  cartridgeId: z.string().optional().nullable(),
  barrelLengthIn: z.number().positive().optional().nullable(),
  twistRate: z.string().max(40).optional().nullable(),
  opticNotes: z.string().max(2000).optional().nullable(),
  zeroDistanceYd: z.number().positive().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.rifle.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { name: 'asc' },
    include: {
      cartridge: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = rifleInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.cartridgeId) {
    const cartridge = await prisma.cartridge.findFirst({
      where: { id: data.cartridgeId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!cartridge) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['cartridgeId'],
              code: 'INVALID_REF',
              message: 'Cartridge not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }

  const row = await prisma.rifle.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      cartridgeId: data.cartridgeId || null,
      barrelLengthIn: data.barrelLengthIn ?? null,
      twistRate: data.twistRate ?? null,
      opticNotes: data.opticNotes ?? null,
      zeroDistanceYd: data.zeroDistanceYd ?? null,
      notes: data.notes ?? null,
    },
  });
  // TODO(audit): write AuditEvent { entityType: 'Rifle', entityId, action: 'create' }
  return NextResponse.json(row, { status: 201 });
}
