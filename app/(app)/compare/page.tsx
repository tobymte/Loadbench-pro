import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { buildCompareRows } from '@/lib/analysis/compare';
import { CompareTable } from './CompareTable';

export const dynamic = 'force-dynamic';

export default async function ComparePage() {
  const ctx = await getWorkspaceContext();

  const loads = await prisma.load.findMany({
    where: { workspaceId: ctx.workspaceId },
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
            {rows.length === 0 ? (
              <EmptyState
                title="No loads to compare"
                description="Record loads (and link sessions to them) to see a side-by-side comparison here."
              />
            ) : (
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
