import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getOnboardingState } from '@/lib/onboarding/state';

// /onboarding
//
// First-login wizard. The state is derived live from existing workspace data,
// so no migration is required and the page is always honest about what is
// actually present in the database.

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const state = await getOnboardingState();

  if (state.setupError) {
    return (
      <>
        <Topbar
          title="Welcome to LoadBench Pro"
          actions={<Badge tone="warning">Setup required</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <Card>
            <CardHeader
              title="Workspace not ready"
              description="Onboarding cannot read your workspace because the database is not reachable. Pressure prediction stays disabled regardless."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted">{state.setupError}</p>
              <Link href="/settings/deployment" className="text-[12px] text-accent mt-2 inline-block">
                Open deployment guide →
              </Link>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Welcome to LoadBench Pro"
        actions={
          state.isComplete ? (
            <Badge tone="success">Onboarding complete</Badge>
          ) : (
            <Badge tone="warning">
              {state.doneCount} of {state.totalRequired}
            </Badge>
          )
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card className="border-accent/40">
          <CardHeader
            title="A safety-first reloading notebook"
            description="LoadBench Pro records what you load and the source you cite. It will never recommend a charge or rate the safety of a load. This wizard walks you through the minimum data needed before you can record a load."
            actions={
              <Link href="/safety">
                <Button size="sm" variant="secondary">
                  Read safety policy
                </Button>
              </Link>
            }
          />
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-bg-inset rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${state.pct}%` }}
                  aria-label="Onboarding progress"
                />
              </div>
              <span className="text-[12px] text-text-muted tabular-nums">{state.pct}%</span>
            </div>
          </CardBody>
        </Card>

        <ol className="space-y-3">
          {state.steps.map((step, i) => (
            <li key={step.key}>
              <Card
                className={
                  step.done
                    ? 'border-success/30'
                    : step.optional
                      ? 'border-border'
                      : 'border-border'
                }
              >
                <CardBody className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={
                        'h-7 w-7 shrink-0 rounded-full border flex items-center justify-center text-[12px] font-semibold ' +
                        (step.done
                          ? 'border-success/40 bg-success-subtle text-success'
                          : 'border-border bg-bg-inset text-text-muted')
                      }
                      aria-hidden
                    >
                      {step.done ? '✓' : i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-text">{step.title}</h2>
                        {step.optional && <Badge tone="neutral">Optional</Badge>}
                        {step.done && <Badge tone="success">Done</Badge>}
                      </div>
                      <p className="text-[12px] text-text-muted leading-relaxed mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  <div className="sm:ml-auto">
                    <Link href={step.href}>
                      <Button size="sm" variant={step.done ? 'secondary' : 'primary'}>
                        {step.cta}
                      </Button>
                    </Link>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>

        <Card>
          <CardHeader
            title="When you're ready"
            description="Once you have a source, a cartridge, a component, a rifle, a load, and a session you have a working notebook. From there the dashboard is the main hub."
          />
          <CardBody className="flex flex-wrap gap-2">
            <Link href="/dashboard">
              <Button>Open dashboard</Button>
            </Link>
            <Link href="/settings">
              <Button variant="secondary">Workspace settings</Button>
            </Link>
            <Link href="/settings/deployment">
              <Button variant="secondary">Deployment guide</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
