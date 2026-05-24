import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { getEngineUrl } from '@/lib/ballistics/engineClient';
import { loadBallisticsPrefills } from '@/lib/ballistics/prefills';
import { BallisticsCalculator } from './BallisticsCalculator';

export const dynamic = 'force-dynamic';

export default async function BallisticsPage() {
  const { prefills, prefillsAvailable, prefillError } =
    await loadBallisticsPrefills();
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

            {!prefillsAvailable && (
              <div
                className="mb-4 rounded-md border border-border bg-bg-alt/40 px-4 py-3 text-[12px] text-text-muted"
                data-testid="ballistics-prefill-unavailable"
              >
                <div className="font-medium text-text mb-1">
                  Saved-load prefill is unavailable.
                </div>
                <p>
                  {prefillError === 'no-database'
                    ? 'No database is configured (DATABASE_URL is not set), so saved loads cannot be listed here.'
                    : prefillError === 'unauthenticated'
                    ? 'You are not signed in, so saved loads cannot be listed here.'
                    : 'Saved loads could not be loaded right now.'}{' '}
                  You can still enter values manually below — the external
                  ballistics calculator works without a database.
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
