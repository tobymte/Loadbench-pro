import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

const sessionInput = z.object({
  loadId: z.string().optional().nullable(),
  rifleId: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  location: z.string().max(240).optional().nullable(),
  tempF: z.number().optional().nullable(),
  humidityPct: z.number().min(0).max(100).optional().nullable(),
  pressureInHg: z.number().positive().optional().nullable(),
  windMph: z.number().min(0).optional().nullable(),
  shotsFired: z.number().int().min(0).optional().nullable(),
  avgVelocityFps: z.number().positive().optional().nullable(),
  esFps: z.number().min(0).optional().nullable(),
  sdFps: z.number().min(0).optional().nullable(),
  groupSizeIn: z.number().min(0).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.rangeSession.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { date: 'desc' },
    include: {
      load: { select: { id: true, name: true } },
      rifle: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = sessionInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Validate cross-workspace references where supplied.
  if (data.loadId) {
    const load = await prisma.load.findFirst({
      where: { id: data.loadId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!load) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['loadId'],
              code: 'INVALID_REF',
              message: 'Load not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }
  if (data.rifleId) {
    const rifle = await prisma.rifle.findFirst({
      where: { id: data.rifleId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!rifle) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['rifleId'],
              code: 'INVALID_REF',
              message: 'Rifle not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }
  }

  let date: Date = new Date();
  if (data.date) {
    const parsedDate = new Date(data.date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['date'],
              code: 'INVALID_SHAPE',
              message: 'Invalid date.',
            },
          ],
        },
        { status: 400 },
      );
    }
    date = parsedDate;
  }

  const row = await prisma.rangeSession.create({
    data: {
      workspaceId: ctx.workspaceId,
      loadId: data.loadId || null,
      rifleId: data.rifleId || null,
      date,
      location: data.location ?? null,
      tempF: data.tempF ?? null,
      humidityPct: data.humidityPct ?? null,
      pressureInHg: data.pressureInHg ?? null,
      windMph: data.windMph ?? null,
      shotsFired: data.shotsFired ?? null,
      avgVelocityFps: data.avgVelocityFps ?? null,
      esFps: data.esFps ?? null,
      sdFps: data.sdFps ?? null,
      groupSizeIn: data.groupSizeIn ?? null,
      notes: data.notes ?? null,
    },
  });
  // TODO(audit): write AuditEvent { entityType: 'RangeSession', entityId, action: 'create' }
  return NextResponse.json(row, { status: 201 });
}
