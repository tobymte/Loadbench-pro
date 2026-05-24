import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { describeUnavailability, safeWithWorkspace } from '@/lib/db/safeLoad';
import { buildCompareRows } from '@/lib/analysis/compare';
import { CompareTable } from './CompareTable';

export const dynamic = 'force-dynamic';

export default async function ComparePage() {
  const result = await safeWithWorkspace(async ({ workspaceId, prisma }) => {
    return prisma.load.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        cartridge: { select: { id: true, name: true } },
        bullet: { select: { id: true, manufacturer: true, model: true } },
        powder: { select: { id: true, manufacturer: true, model: true } },
        rifle: { select: { id: true, name: true } },
        source: { select: { id: true, title: true } },
        sessions: {
          select: {
            date: true,
            avgVelocityFps: true,
            esFps: true,
            sdFps: true,
            groupSizeIn: true,
            groupDistanceYd: true,
          },
        },
      },
    });
  });

  return (
    <>
      <Topbar title="Compare loads" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Side-by-side load comparison"
            description="Filter and compare loads using observed session data only. LoadBench Pro does not interpret these numbers, does not validate safety, and does not compare loads on a pressure or charge basis."
          />
          <CardBody>
            {!result.ok ? (
              <CompareUnavailable reason={result.reason} />
            ) : (
              <CompareContent loads={result.data} />
            )}
            <p className="mt-4 text-[11px] text-text-faint">
              Observed data only. No safety, pressure, or charge validation.
              Best-group and averages are computed from the range sessions you
              have logged against each load.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function CompareUnavailable({
  reason,
}: {
  reason: 'no-database' | 'unauthenticated' | 'lookup-failed';
}) {
  return (
    <div
      className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[12px] text-text"
      data-testid="compare-unavailable"
    >
      <div className="font-medium text-warning mb-1">
        Saved-load comparison is unavailable.
      </div>
      <p className="text-text-muted">
        {describeUnavailability(reason)} Side-by-side comparison reads from your
        saved loads and range sessions, so it cannot be shown until a database
        is configured and reachable.
      </p>
      {reason === 'no-database' && (
        <pre className="mt-2 text-[11px] bg-bg-alt/60 p-2 rounded overflow-x-auto">
{`# in .env.local
DATABASE_URL=postgresql://user:password@localhost:5432/loadbench

# then run migrations and restart the dev server
npx prisma migrate deploy
npm run dev`}
        </pre>
      )}
      <p className="mt-2 text-text-muted">
        Once configured, recorded loads and sessions will appear here for
        side-by-side review. No safety, pressure, or charge validation is
        performed.
      </p>
    </div>
  );
}

type LoadWithRelations = {
  id: string;
  name: string;
  status: string;
  chargeGr: number | null;
  safetyAcknowledged: boolean;
  cartridgeId: string | null;
  rifleId: string | null;
  powderId: string | null;
  bulletId: string | null;
  sourceId: string | null;
  cartridge: { id: string; name: string } | null;
  bullet: { id: string; manufacturer: string; model: string } | null;
  powder: { id: string; manufacturer: string; model: string } | null;
  rifle: { id: string; name: string } | null;
  source: { id: string; title: string } | null;
  sessions: Array<{
    date: Date;
    avgVelocityFps: number | null;
    esFps: number | null;
    sdFps: number | null;
    groupSizeIn: number | null;
    groupDistanceYd: number | null;
  }>;
};

function CompareContent({ loads }: { loads: LoadWithRelations[] }) {
  const rows = buildCompareRows(loads);

  const cartridges = uniqueBy(
    loads.map((l) => l.cartridge).filter(Boolean) as Array<{ id: string; name: string }>,
    (c) => c.id,
  );
  const rifles = uniqueBy(
    loads.map((l) => l.rifle).filter(Boolean) as Array<{ id: string; name: string }>,
    (r) => r.id,
  );
  const powders = uniqueBy(
    loads
      .map((l) => l.powder)
      .filter(Boolean) as Array<{ id: string; manufacturer: string; model: string }>,
    (p) => p.id,
  ).map((p) => ({ id: p.id, label: `${p.manufacturer} ${p.model}` }));
  const bullets = uniqueBy(
    loads
      .map((l) => l.bullet)
      .filter(Boolean) as Array<{ id: string; manufacturer: string; model: string }>,
    (b) => b.id,
  ).map((b) => ({ id: b.id, label: `${b.manufacturer} ${b.model}` }));
  const sources = uniqueBy(
    loads.map((l) => l.source).filter(Boolean) as Array<{ id: string; title: string }>,
    (s) => s.id,
  );

  const loadMeta = loads.map((l) => ({
    id: l.id,
    cartridgeId: l.cartridgeId ?? null,
    rifleId: l.rifleId ?? null,
    powderId: l.powderId ?? null,
    bulletId: l.bulletId ?? null,
    sourceId: l.sourceId ?? null,
  }));

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No loads to compare"
        description="Record loads (and link sessions to them) to see a side-by-side comparison here."
      />
    );
  }

  return (
    <CompareTable
      rows={rows}
      meta={loadMeta}
      filterOptions={{
        cartridges: cartridges.map((c) => ({ value: c.id, label: c.name })),
        rifles: rifles.map((r) => ({ value: r.id, label: r.name })),
        powders: powders.map((p) => ({ value: p.id, label: p.label })),
        bullets: bullets.map((b) => ({ value: b.id, label: b.label })),
        sources: sources.map((s) => ({ value: s.id, label: s.title })),
      }}
    />
  );
}

function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
