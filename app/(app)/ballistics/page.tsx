import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { BallisticsCalculator } from './BallisticsCalculator';

export const dynamic = 'force-dynamic';

export default async function BallisticsPage() {
  const ctx = await getWorkspaceContext();

  const loads = await prisma.load.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: {
      bullet: {
        select: {
          manufacturer: true,
          model: true,
          bulletWeightGr: true,
          bulletBc: true,
        },
      },
      rifle: { select: { zeroDistanceYd: true } },
      sessions: {
        select: { date: true, avgVelocityFps: true },
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  const prefills = loads.map((l) => ({
    id: l.id,
    label: l.bullet
      ? `${l.name} — ${l.bullet.manufacturer} ${l.bullet.model}`
      : l.name,
    bulletWeightGr: l.bullet?.bulletWeightGr ?? null,
    bcG1: l.bullet?.bulletBc ?? null,
    muzzleVelocityFps: l.sessions[0]?.avgVelocityFps ?? null,
    zeroDistanceYd: l.rifle?.zeroDistanceYd ?? null,
  }));

  return (
    <>
      <Topbar title="Ballistics calculator" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="External ballistics estimate"
            description="Trajectory estimate from user-entered muzzle velocity, bullet weight, and G1 ballistic coefficient. Educational use only."
          />
          <CardBody>
            <div
              className="mb-4 rounded-md border border-danger/40 bg-danger-subtle px-4 py-3 text-[12px] text-text"
              data-testid="ballistics-disclaimer"
            >
              <div className="font-medium text-danger mb-1">
                Educational external-ballistics estimate only.
              </div>
              <p className="text-text-muted">
                This calculator integrates a simplified flat-fire G1
                trajectory from numbers <strong>you</strong> enter. It is
                <strong> not</strong> a load engine. It does <strong>not</strong>{' '}
                perform internal-ballistics or pressure prediction (QuickLOAD,
                GRT, etc.). It does <strong>not</strong> validate the safety
                of any load. Use it to estimate drop and drift for shooting
                practice; verify against actual range data before relying on
                any output.
              </p>
            </div>
            <BallisticsCalculator prefills={prefills} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
