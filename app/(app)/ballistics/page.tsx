import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { getEngineUrl } from '@/lib/ballistics/engineClient';
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

  const engineConfigured = getEngineUrl() !== null;

  return (
    <>
      <Topbar title="Ballistics calculator" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="External ballistics estimate"
            description="Trajectory, drop, drift, time of flight, retained velocity, and energy from a dedicated downrange-ballistics engine. External flight only — not pressure or load safety guidance."
          />
          <CardBody>
            <div
              className="mb-4 rounded-md border border-danger/40 bg-danger-subtle px-4 py-3 text-[12px] text-text"
              data-testid="ballistics-disclaimer"
            >
              <div className="font-medium text-danger mb-1">
                External flight estimates only — not pressure / load safety guidance.
              </div>
              <p className="text-text-muted">
                These numbers describe how the bullet flies <strong>after</strong>{' '}
                it leaves the muzzle: drop, drift, time of flight, retained
                velocity, and energy. They are computed by a separate
                downrange-ballistics engine (intended to wrap{' '}
                <a
                  href="https://github.com/gehtsoft-usa/BallisticCalculator1"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  BallisticCalculator1
                </a>
                , LGPL-2.1). This tool does <strong>not</strong> predict chamber
                pressure or PSI, does <strong>not</strong> recommend charge
                weights, does <strong>not</strong> issue safe/unsafe verdicts,
                and does <strong>not</strong> suggest powder substitutions.
                Verify against actual chronograph and target data.
              </p>
            </div>

            {!engineConfigured && (
              <div
                className="mb-4 rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[12px] text-text"
                data-testid="ballistics-unconfigured"
              >
                <div className="font-medium text-warning mb-1">
                  Ballistics engine not configured.
                </div>
                <p className="text-text-muted">
                  Set <code>BALLISTICS_ENGINE_URL</code> in <code>.env.local</code>{' '}
                  to point at the downrange-ballistics service. To run it locally:
                </p>
                <pre className="mt-2 text-[11px] bg-bg-alt/60 p-2 rounded overflow-x-auto">
{`cd services/ballistics-engine
dotnet restore
dotnet run            # listens on http://localhost:5080

# then in the Next.js app's .env.local:
BALLISTICS_ENGINE_URL=http://localhost:5080`}
                </pre>
                <p className="mt-2 text-text-muted">
                  See <code>services/ballistics-engine/README.md</code> and the
                  project README for hosting notes and LGPL attribution.
                </p>
              </div>
            )}

            <BallisticsCalculator
              prefills={prefills}
              engineConfigured={engineConfigured}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
