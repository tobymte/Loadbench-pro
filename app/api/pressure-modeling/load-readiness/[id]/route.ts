import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { analyzeLoadReadiness } from '@/lib/analysis/pressureReadiness';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getWorkspaceContext();
  const load = await prisma.load.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: {
      cartridge: true,
      bullet: true,
      powder: true,
      primer: true,
      case_: true,
      rifle: true,
      source: true,
      sessions: {
        select: {
          tempF: true,
          humidityPct: true,
          pressureInHg: true,
          avgVelocityFps: true,
          esFps: true,
          sdFps: true,
          shotsFired: true,
        },
      },
    },
  });

  if (!load) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const report = analyzeLoadReadiness(load);
  return NextResponse.json({
    load: { id: load.id, name: load.name },
    readiness: report,
  });
}
