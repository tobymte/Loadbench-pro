import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { analyzeLoadReadiness } from '@/lib/analysis/pressureReadiness';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getWorkspaceContext();
  const load = await prisma.load.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
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

  // Counts of related solver-input records. These are presence indicators
  // only — no computation reads from them.
  const [
    caseCapacityCount,
    bulletDimensionCount,
    powderMetadataCount,
    barrelGeometryCount,
    chronoCalibrationCount,
  ] = await Promise.all([
    prisma.caseCapacityMeasurement.count({
      where: {
        workspaceId: ctx.workspaceId,
        OR: [
          { cartridgeId: load.cartridgeId },
          { loadId: load.id },
          load.caseId ? { brassComponentId: load.caseId } : { id: '' },
        ],
      },
    }),
    prisma.bulletDimensionRecord.count({
      where: {
        workspaceId: ctx.workspaceId,
        componentId: load.bulletId,
      },
    }),
    prisma.powderMetadataRecord.count({
      where: {
        workspaceId: ctx.workspaceId,
        componentId: load.powderId,
      },
    }),
    load.rifleId
      ? prisma.barrelGeometryRecord.count({
          where: {
            workspaceId: ctx.workspaceId,
            rifleId: load.rifleId,
          },
        })
      : Promise.resolve(0),
    prisma.chronoCalibrationRecord.count({
      where: { workspaceId: ctx.workspaceId },
    }),
  ]);

  return NextResponse.json({
    load: { id: load.id, name: load.name },
    readiness: report,
    solverInputCounts: {
      caseCapacity: caseCapacityCount,
      bulletDimensions: bulletDimensionCount,
      powderMetadata: powderMetadataCount,
      barrelGeometry: barrelGeometryCount,
      chronoCalibration: chronoCalibrationCount,
    },
  });
}
