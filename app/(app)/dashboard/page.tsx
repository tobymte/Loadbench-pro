import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { NextStepList, type NextStep } from '@/components/ui/NextStep';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { FEATURE_KEYS, getEntitlement } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';

type DashboardData = {
  ok: true;
  counts: {
    cartridges: number;
    components: number;
    rifles: number;
    sources: number;
    loads: number;
    sessions: number;
    publishedRowsVerified: number;
    publishedRowsTotal: number;
    pressureRuns: number;
  };
  pressureAccess: boolean;
  recentLoads: Array<{
    id: string;
    name: string;
    status: string;
    cartridgeName: string | null;
    chargeGr: number | null;
    sourceTitle: string | null;
  }>;
  recentSessions: Array<{
    id: string;
    date: Date;
    loadName: string | null;
    rifleName: string | null;
    avgVelocityFps: number | null;
    groupSizeIn: number | null;
  }>;
};

type DashboardError = { ok: false; message: string };

async function loadDashboard(): Promise<DashboardData | DashboardError> {
  try {
    const ctx = await getWorkspaceContext();
    const wid = ctx.workspaceId;

    const [
      cartridges,
      components,
      rifles,
      sources,
      loads,
      sessions,
      publishedRowsVerified,
      publishedRowsTotal,
      pressureRuns,
      recentLoadsRaw,
      recentSessionsRaw,
      entitlement,
    ] = await Promise.all([
      prisma.cartridge.count({ where: { workspaceId: wid } }),
      prisma.component.count({ where: { workspaceId: wid } }),
      prisma.rifle.count({ where: { workspaceId: wid } }),
      prisma.source.count({ where: { workspaceId: wid } }),
      prisma.load.count({ where: { workspaceId: wid } }),
      prisma.rangeSession.count({ where: { workspaceId: wid } }),
      prisma.publishedLoadRowDraft.count({
        where: { workspaceId: wid, status: 'VERIFIED' },
      }),
      prisma.publishedLoadRowDraft.count({ where: { workspaceId: wid } }),
      prisma.pressureEngineRun.count({ where: { workspaceId: wid } }),
      prisma.load.findMany({
        where: { workspaceId: wid },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          cartridge: { select: { name: true } },
          source: { select: { title: true } },
        },
      }),
      prisma.rangeSession.findMany({
        where: { workspaceId: wid },
        orderBy: { date: 'desc' },
        take: 4,
        include: {
          load: { select: { name: true } },
          rifle: { select: { name: true } },
        },
      }),
      getEntitlement(wid, FEATURE_KEYS.PRESSURE_MODELING).catch(() => null),
    ]);

    return {
      ok: true,
      counts: {
        cartridges,
        components,
        rifles,
        sources,
        loads,
        sessions,
        publishedRowsVerified,
        publishedRowsTotal,
        pressureRuns,
      },
      pressureAccess: !!entitlement?.hasAccess,
      recentLoads: recentLoadsRaw.map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        cartridgeName: l.cartridge?.name ?? null,
        chargeGr: l.chargeGr ?? null,
        sourceTitle: l.source?.title ?? null,
      })),
      recentSessions: recentSessionsRaw.map((s) => ({
        id: s.id,
        date: s.date,
        loadName: s.load?.name ?? null,
        rifleName: s.rifle?.name ?? null,
        avgVelocityFps: s.avgVelocityFps ?? null,
        groupSizeIn: s.groupSizeIn ?? null,
      })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error.';
    return { ok: false, message };
  }
}

function buildNextSteps(d: DashboardData): NextStep[] {
  const c = d.counts;
  return [
    {
      key: 'sources',
      title: 'Cite a published source',
      description:
        'Loads cannot save a charge without a citation. Record your manuals and manufacturer data sheets first.',
      href: '/sources',
      cta: c.sources === 0 ? 'Add a source' : 'Manage sources',
      status: c.sources > 0 ? 'done' : 'todo',
    },
    {
      key: 'cartridges',
      title: 'Add cartridges you reload for',
      description:
        'Cartridges are the reference frame for every load and component link.',
      href: '/cartridges',
      cta: c.cartridges === 0 ? 'Add a cartridge' : 'Manage cartridges',
      status: c.cartridges > 0 ? 'done' : 'todo',
    },
    {
      key: 'components',
      title: 'Stock bullets, powders, primers, cases',
      description:
        'Track each lot so range sessions can attribute usage and lot numbers.',
      href: '/components',
      cta: c.components === 0 ? 'Add a component' : 'Manage components',
      status: c.components > 0 ? 'done' : 'todo',
    },
    {
      key: 'rifles',
      title: 'Add at least one rifle',
      description: 'Rifle profiles let you tag sessions and loads to a barrel.',
      href: '/rifles',
      cta: c.rifles === 0 ? 'Add a rifle' : 'Manage rifles',
      status: c.rifles > 0 ? 'done' : 'todo',
    },
    {
      key: 'loads',
      title: 'Record your first load',
      description:
        'Pick the cartridge, bullet, powder, and cited source. A charge will only save if it is at or below the published max on your citation.',
      href: '/loads/new',
      cta: c.loads === 0 ? 'Record a load' : 'New load',
      status: c.loads > 0 ? 'done' : 'todo',
    },
    {
      key: 'sessions',
      title: 'Log a range session',
      description:
        'Record observed velocity, ES/SD, and group size. Use chrono import to paste a chronograph CSV.',
      href: '/sessions',
      cta: c.sessions === 0 ? 'Log a session' : 'Add a session',
      status: c.sessions > 0 ? 'done' : 'todo',
    },
  ];
}

function workflowProgress(d: DashboardData) {
  const steps = buildNextSteps(d);
  const done = steps.filter((s) => s.status === 'done').length;
  return { done, total: steps.length, steps };
}

function SetupErrorState({ message }: { message: string }) {
  return (
    <>
      <Topbar
        title="Dashboard"
        actions={<Badge tone="warning">Setup required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Workspace not ready yet"
            description="The dashboard could not load workspace data. Pressure prediction stays disabled regardless of setup state."
          />
          <CardBody>
            <div
              className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2"
              data-testid="dashboard-setup-required"
            >
              <p>
                <strong className="font-semibold">Could not load workspace data.</strong>{' '}
                The underlying details:
              </p>
              <p className="text-[12px] text-text-muted">{message}</p>
              <div className="text-[12px] text-text-muted space-y-1">
                <p className="font-medium text-text">Typical fixes (local dev):</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  <li>
                    Copy <code className="text-accent">.env.example</code> to{' '}
                    <code className="text-accent">.env.local</code> and set{' '}
                    <code className="text-accent">DATABASE_URL</code>.
                  </li>
                  <li>
                    Run <code className="text-accent">npx prisma migrate deploy</code>{' '}
                    (or <code className="text-accent">npm run prisma:migrate -- --name init</code>{' '}
                    on a fresh database).
                  </li>
                  <li>
                    Run <code className="text-accent">npx prisma generate</code>.
                  </li>
                  <li>
                    Restart the dev server with <code className="text-accent">npm run dev</code>.
                  </li>
                </ol>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

type Workflow = {
  key: string;
  title: string;
  description: string;
  href: string;
  count: number;
  unit: string;
  cta: string;
  badge?: { tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'; label: string };
};

function buildWorkflows(d: DashboardData): Workflow[] {
  const c = d.counts;
  return [
    {
      key: 'sources',
      title: 'Sources',
      description: 'Published references you cite when recording a load.',
      href: '/sources',
      count: c.sources,
      unit: c.sources === 1 ? 'source' : 'sources',
      cta: c.sources === 0 ? 'Add your first source' : 'Manage sources',
    },
    {
      key: 'cartridges',
      title: 'Cartridges',
      description: 'SAAMI/CIP cartridge reference data used by loads.',
      href: '/cartridges',
      count: c.cartridges,
      unit: c.cartridges === 1 ? 'cartridge' : 'cartridges',
      cta: c.cartridges === 0 ? 'Add a cartridge' : 'Open library',
    },
    {
      key: 'components',
      title: 'Components & inventory',
      description: 'Bullets, powders, primers, cases — by lot, with usage.',
      href: '/components',
      count: c.components,
      unit: c.components === 1 ? 'component' : 'components',
      cta: c.components === 0 ? 'Add components' : 'Open inventory',
    },
    {
      key: 'rifles',
      title: 'Rifles',
      description: 'Rifle profiles linked to cartridges, sessions, and loads.',
      href: '/rifles',
      count: c.rifles,
      unit: c.rifles === 1 ? 'rifle' : 'rifles',
      cta: c.rifles === 0 ? 'Add a rifle' : 'Manage rifles',
    },
    {
      key: 'loads',
      title: 'Loads',
      description: 'Charges you have recorded, each tied to a cited source.',
      href: '/loads',
      count: c.loads,
      unit: c.loads === 1 ? 'load' : 'loads',
      cta: c.loads === 0 ? 'Record your first load' : 'Open loads',
    },
    {
      key: 'sessions',
      title: 'Range sessions',
      description: 'Observed velocity, ES/SD, and group size by session.',
      href: '/sessions',
      count: c.sessions,
      unit: c.sessions === 1 ? 'session' : 'sessions',
      cta: c.sessions === 0 ? 'Log a session' : 'Open sessions',
    },
    {
      key: 'published',
      title: 'Published-data review',
      description: 'Stage and verify published rows before citing them on a load.',
      href: '/published-data-review',
      count: c.publishedRowsVerified,
      unit:
        c.publishedRowsTotal === 0
          ? 'no rows staged'
          : `verified of ${c.publishedRowsTotal}`,
      cta: c.publishedRowsTotal === 0 ? 'Start staging' : 'Continue review',
      badge:
        c.publishedRowsTotal > c.publishedRowsVerified
          ? { tone: 'warning', label: 'Needs review' }
          : undefined,
    },
    {
      key: 'simulation',
      title: 'Simulation sandbox',
      description: 'Non-operational scenario sandbox — no pressure or charge output.',
      href: '/simulation-sandbox',
      count: 0,
      unit: '',
      cta: 'Open sandbox',
      badge: { tone: 'warning', label: 'Non-operational' },
    },
    {
      key: 'pressure',
      title: 'Pressure engine',
      description:
        'Premium validation workspace. Records data completeness and a velocity-only delta. No PSI, charge, or verdict.',
      href: d.pressureAccess ? '/pressure-engine' : '/pressure-engine',
      count: d.pressureAccess ? d.counts.pressureRuns : 0,
      unit: d.pressureAccess
        ? d.counts.pressureRuns === 1
          ? 'run'
          : 'runs'
        : '',
      cta: d.pressureAccess ? 'Open pressure engine' : 'See premium details',
      badge: d.pressureAccess
        ? { tone: 'accent', label: 'Premium' }
        : { tone: 'neutral', label: 'Premium · locked' },
    },
  ];
}

function WorkflowCard({ w }: { w: Workflow }) {
  return (
    <Link
      href={w.href}
      className="rounded-lg border border-border bg-bg-surface p-4 hover:border-border-strong transition-colors flex flex-col"
      data-testid={`workflow-card-${w.key}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{w.title}</h3>
        {w.badge && <Badge tone={w.badge.tone}>{w.badge.label}</Badge>}
      </div>
      <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
        {w.description}
      </p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold text-text tabular-nums">
          {w.count}
        </span>
        {w.unit && (
          <span className="text-[11px] text-text-faint uppercase tracking-wider">
            {w.unit}
          </span>
        )}
      </div>
      <div className="mt-3 text-[12px] text-accent">{w.cta} →</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const data = await loadDashboard();

  if (!data.ok) {
    return <SetupErrorState message={data.message} />;
  }

  const workflows = buildWorkflows(data);
  const { steps, done, total } = workflowProgress(data);
  const isFirstRun = data.counts.loads === 0 && data.counts.sessions === 0;
  const pct = Math.round((done / total) * 100);

  return (
    <>
      <Topbar
        title="Dashboard"
        actions={
          <>
            <Link href="/notebook">
              <Button size="sm" variant="secondary">
                Printables
              </Button>
            </Link>
            <Link href="/loads/new">
              <Button size="sm" data-testid="dashboard-new-load">
                + New load
              </Button>
            </Link>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        {isFirstRun && (
          <Card
            className="border-accent/40"
            data-testid="dashboard-first-run-banner"
          >
            <CardHeader
              title="Welcome to LoadBench Pro"
              description="A safety-first reloading notebook. It records what you load and the published source you cite. It will never recommend a charge or rate safety."
              actions={
                <>
                  <Link href="/onboarding">
                    <Button size="sm" data-testid="dashboard-onboarding-cta">
                      Start onboarding
                    </Button>
                  </Link>
                  <Link href="/safety">
                    <Button size="sm" variant="secondary">
                      Read safety policy
                    </Button>
                  </Link>
                </>
              }
            />
            <CardBody>
              <p className="text-[12px] text-text-muted leading-relaxed">
                Set up your workspace in this order: cite published sources,
                add the cartridges and components you reload for, add a rifle,
                then record your first load. Each step links to the matching
                page.
              </p>
            </CardBody>
          </Card>
        )}

        <section data-testid="dashboard-primary-tasks">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] uppercase tracking-wider text-text-faint font-medium">
              Start here
            </h2>
            <span className="text-[11px] text-text-faint">Common tasks</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                key: 'add-load',
                title: 'Add a load',
                description:
                  'Record a charge tied to a cited published source. No charge advice — just what you loaded.',
                href: '/loads/new',
                cta: 'New load',
              },
              {
                key: 'import',
                title: 'Import data',
                description:
                  'Bring in CSV/TSV: published-manual rows, chronograph strings, components, or measurements.',
                href: '/data-import',
                cta: 'Open import wizard',
              },
              {
                key: 'log-session',
                title: 'Log a range session',
                description:
                  'Capture observed velocity, ES/SD, and group size. Paste a chrono CSV if you have one.',
                href: '/sessions',
                cta: 'New session',
              },
              {
                key: 'review',
                title: 'Review data',
                description:
                  'Verify published-manual rows and surface missing fields before citing them on a load.',
                href: '/data-quality',
                cta: 'Open data quality',
              },
              {
                key: 'ballistics',
                title: 'Open tools & ballistics',
                description:
                  'Compare loads side-by-side or run an educational G1 trajectory from your inputs.',
                href: '/ballistics',
                cta: 'Open ballistics',
              },
              {
                key: 'pressure-setup',
                title: 'Set up pressure validation',
                description:
                  'Premium validation workspace — readiness checklist, data inputs, and sandbox. No PSI output.',
                href: '/pressure-engine/setup',
                cta: 'Open setup wizard',
              },
            ].map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className="rounded-lg border border-border bg-bg-surface p-4 hover:border-border-strong transition-colors flex flex-col"
                data-testid={`primary-task-${t.key}`}
              >
                <h3 className="text-sm font-semibold text-text">{t.title}</h3>
                <p className="text-[12px] text-text-muted mt-1 leading-relaxed flex-1">
                  {t.description}
                </p>
                <div className="mt-3 text-[12px] text-accent">{t.cta} →</div>
              </Link>
            ))}
          </div>
        </section>

        <Card data-testid="dashboard-next-steps">
          <CardHeader
            title="Recommended setup path"
            description={`${done} of ${total} steps complete (${pct}%). Each step is a real page — click through to add data.`}
            actions={
              done === total ? (
                <Badge tone="success">Workspace ready</Badge>
              ) : (
                <Badge tone="warning">Setup in progress</Badge>
              )
            }
          />
          <CardBody>
            <NextStepList steps={steps} testid="dashboard-next-step-list" />
          </CardBody>
        </Card>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] uppercase tracking-wider text-text-faint font-medium">
              Workflows
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {workflows.map((w) => (
              <WorkflowCard key={w.key} w={w} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <Card>
            <CardHeader
              title="Recent loads"
              description="The five most recent recorded loads. Status reflects what you have entered, not safety."
              actions={
                <Link href="/loads">
                  <Button size="sm" variant="secondary">
                    View all
                  </Button>
                </Link>
              }
            />
            <CardBody className="!p-0">
              {data.recentLoads.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    tone="accent"
                    title="No loads recorded yet"
                    description="Create your first load from a published reference and a cited source. LoadBench Pro will not save a charge weight without both."
                    action={
                      <Link href="/loads/new">
                        <Button>Record a load</Button>
                      </Link>
                    }
                    secondaryAction={
                      <Link href="/sources">
                        <Button variant="secondary">Add a source first</Button>
                      </Link>
                    }
                    testid="dashboard-recent-loads-empty"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentLoads.map((l) => (
                    <li
                      key={l.id}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-bg-alt/30"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/loads/${l.id}`}
                          className="text-sm font-medium text-text hover:text-accent"
                        >
                          {l.name}
                        </Link>
                        <div className="text-[11px] text-text-muted truncate">
                          {l.cartridgeName ?? 'No cartridge'} ·{' '}
                          {l.chargeGr != null ? `${l.chargeGr} gr` : 'no charge'} ·{' '}
                          {l.sourceTitle ?? 'no source'}
                        </div>
                      </div>
                      <Badge
                        tone={
                          l.status === 'TESTED'
                            ? 'success'
                            : l.status === 'LOADED'
                              ? 'accent'
                              : 'neutral'
                        }
                      >
                        {l.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Safety checklist"
              description="Before each session, run through this list."
            />
            <CardBody>
              <ul className="space-y-3 text-sm">
                {[
                  'I am using only data from published, current reference sources.',
                  'I have verified case, primer, powder, and bullet match the source.',
                  'I will start at the published starting load and work up.',
                  'I will watch for pressure signs before every increment.',
                  'I will not exceed the cited published maximum charge.',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <span className="h-4 w-4 mt-0.5 rounded-sm border border-border bg-bg-inset shrink-0" />
                    <span className="text-text-muted leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <Badge tone="danger">Required reading</Badge>
                <Link
                  href="/safety"
                  className="text-xs text-accent hover:text-accent-hover"
                >
                  Safety policy →
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Recent range sessions"
            description="Observed data only. Group size and chronograph values are user-entered observations."
            actions={
              <>
                <Link href="/chrono-import">
                  <Button size="sm" variant="secondary">
                    Import chrono CSV
                  </Button>
                </Link>
                <Link href="/sessions">
                  <Button size="sm" variant="secondary">
                    View all
                  </Button>
                </Link>
              </>
            }
          />
          <CardBody className="!p-0">
            {data.recentSessions.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No sessions logged"
                  description="Track velocity, group size, and conditions for each load. Paste a chronograph CSV to import a whole string at once."
                  action={
                    <Link href="/sessions">
                      <Button>Log a session</Button>
                    </Link>
                  }
                  secondaryAction={
                    <Link href="/chrono-import">
                      <Button variant="secondary">Import chrono CSV</Button>
                    </Link>
                  }
                  testid="dashboard-recent-sessions-empty"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentSessions.map((s) => (
                  <li
                    key={s.id}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-bg-alt/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text">
                        {s.loadName ?? 'Unlinked session'}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {new Date(s.date).toLocaleDateString()} ·{' '}
                        {s.rifleName ?? 'no rifle'} ·{' '}
                        {s.avgVelocityFps != null
                          ? `${s.avgVelocityFps.toFixed(0)} fps avg`
                          : 'no chrono'}
                        {s.groupSizeIn != null ? ` · ${s.groupSizeIn}" group` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Tools"
            description="Side-by-side comparison, ballistics estimate, chrono import, and the non-operational pressure-engine workspace."
          />
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                {
                  href: '/compare',
                  title: 'Compare loads',
                  desc: 'Filterable side-by-side comparison.',
                },
                {
                  href: '/ballistics',
                  title: 'Ballistics estimate',
                  desc: 'G1 trajectory from your inputs.',
                },
                {
                  href: '/chrono-import',
                  title: 'Chrono import',
                  desc: 'Paste a chronograph CSV.',
                },
                {
                  href: '/notebook',
                  title: 'Notebook printables',
                  desc: 'Print-ready load and component cards.',
                },
                {
                  href: '/beta/feedback',
                  title: 'Beta feedback',
                  desc: 'File a bug, feature request, or issue.',
                },
              ].map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="rounded-md border border-border bg-bg-surface px-3 py-2.5 hover:border-border-strong transition-colors"
                >
                  <div className="text-[13px] font-medium text-text">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                    {t.desc}
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
