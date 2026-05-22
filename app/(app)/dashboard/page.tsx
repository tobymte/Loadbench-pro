import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';

// TODO(backend): replace the static counts below with `await prisma...` queries
// scoped to the current workspace via getWorkspaceContext().

const STATS = [
  { label: 'Cartridges', value: '—', href: '/cartridges' },
  { label: 'Components', value: '—', href: '/components' },
  { label: 'Loads', value: '—', href: '/loads' },
  { label: 'Range sessions', value: '—', href: '/sessions' },
];

export default function DashboardPage() {
  return (
    <>
      <Topbar
        title="Dashboard"
        actions={
          <Link href="/loads/new">
            <Button>New load</Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-lg border border-border bg-bg-surface p-4 hover:border-border-strong transition-colors"
            >
              <div className="text-[11px] uppercase tracking-wider text-text-faint">
                {s.label}
              </div>
              <div className="text-lg font-semibold text-text mt-1 tabular-nums">
                {s.value}
              </div>
            </Link>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <Card>
            <CardHeader
              title="Recent loads"
              description="Your most recent recorded loads. Status reflects what you have entered, not safety."
              actions={
                <Link href="/loads">
                  <Button size="sm" variant="secondary">
                    View all
                  </Button>
                </Link>
              }
            />
            <CardBody className="!p-0">
              <EmptyState
                title="No loads recorded yet"
                description="Create your first load from a published reference and a cited source. LoadBench Pro will not save a charge weight without both."
                action={
                  <Link href="/loads/new">
                    <Button>Record a load</Button>
                  </Link>
                }
              />
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
      </div>
    </>
  );
}
