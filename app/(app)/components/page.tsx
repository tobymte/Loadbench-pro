import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ComponentForm } from '@/components/forms/ComponentForm';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  estimateUsage,
  estimateRemaining,
  isLowStock,
} from '@/lib/analysis/componentUsage';

export const dynamic = 'force-dynamic';

export default async function ComponentsPage() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.component.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ kind: 'asc' }, { manufacturer: 'asc' }, { model: 'asc' }],
    include: {
      bulletLoads: {
        select: { id: true, chargeGr: true, sessions: { select: { shotsFired: true } } },
      },
      powderLoads: {
        select: { id: true, chargeGr: true, sessions: { select: { shotsFired: true } } },
      },
      primerLoads: {
        select: { id: true, chargeGr: true, sessions: { select: { shotsFired: true } } },
      },
      caseLoads: {
        select: { id: true, chargeGr: true, sessions: { select: { shotsFired: true } } },
      },
    },
  });

  const enriched = rows.map((r) => {
    const loads =
      r.kind === 'BULLET'
        ? r.bulletLoads
        : r.kind === 'POWDER'
          ? r.powderLoads
          : r.kind === 'PRIMER'
            ? r.primerLoads
            : r.caseLoads;
    const usage = estimateUsage(r.kind, loads);
    const remaining = estimateRemaining(
      r.kind,
      r.quantityOnHand,
      r.unit,
      usage,
    );
    const low = isLowStock(r.quantityOnHand, r.lowStockThreshold);
    return { row: r, usage, remaining, low, linkedLoads: loads.length };
  });

  const lowStockCount = enriched.filter((e) => e.low && !e.row.archived).length;

  return (
    <>
      <Topbar title="Components" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <ComponentForm />

        <Card>
          <CardHeader
            title="Inventory & usage caveats"
            description="Stock and usage numbers below are recordkeeping only."
          />
          <CardBody>
            <ul className="text-[12px] text-text-muted leading-relaxed list-disc pl-5 space-y-1">
              <li>
                Quantity on hand reflects what <em>you</em> entered. LoadBench Pro
                does not scan, weigh, or audit physical inventory.
              </li>
              <li>
                Estimated usage is derived from <code>shotsFired</code> and{' '}
                <code>chargeGr</code> on the loads and range sessions you logged.
                Sessions without these values are skipped.
              </li>
              <li>
                Case usage is labeled as <strong>rounds loaded/fired</strong>, not
                case life remaining. Brass life depends on pressure history,
                annealing, and trim/sizing — none of which this app models.
              </li>
              <li>
                LoadBench Pro does <strong>not</strong> recommend substitutions,
                charge weights, or “safe load” claims.
              </li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Usage & lot dashboard"
            description="Recordkeeping summary across every component lot. Estimated remaining is shown only when units match (lb/gr for powder, ct for bullet/primer/case)."
          />
          {enriched.length === 0 ? (
            <CardBody>
              <p className="text-sm text-text-muted">
                Add components above to see usage and lot estimates here.
                Estimated usage is derived only from sessions you have already
                logged.
              </p>
            </CardBody>
          ) : (
            <table data-testid="components-usage-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Kind</th>
                  <th>Lot</th>
                  <th className="text-right">Qty on hand</th>
                  <th className="text-right">Est. used (from sessions)</th>
                  <th className="text-right">Est. remaining</th>
                  <th className="text-right">Linked loads</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((e) => (
                  <tr key={`usage-${e.row.id}`}>
                    <td className="font-medium">
                      <Link
                        href={`/components/${e.row.id}`}
                        className="hover:text-accent"
                      >
                        {e.row.manufacturer} {e.row.model}
                      </Link>
                    </td>
                    <td>
                      <Badge>{e.row.kind}</Badge>
                    </td>
                    <td className="text-text-muted">{e.row.lotNumber ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {e.row.quantityOnHand != null
                        ? `${fmt(e.row.quantityOnHand)}${e.row.unit ? ' ' + e.row.unit : ''}`
                        : '—'}
                    </td>
                    <td className="text-right tabular-nums text-text-muted">
                      {formatUsageShort(e.row.kind, e.usage)}
                    </td>
                    <td className="text-right tabular-nums">
                      {e.remaining
                        ? `${fmt(e.remaining.value)} ${e.remaining.unit}`
                        : '—'}
                    </td>
                    <td className="text-right tabular-nums text-text-muted">
                      {e.linkedLoads}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Component inventory"
            description="Track each lot of each component. Lot numbers matter — record them when you record a session."
            actions={
              lowStockCount > 0 ? (
                <Badge tone="warning" data-testid="components-low-stock-badge">
                  {lowStockCount} low stock
                </Badge>
              ) : undefined
            }
          />
          {enriched.length === 0 ? (
            <div className="p-5">
              <EmptyState
                tone="accent"
                title="No components recorded yet"
                description="Start by adding the bullets, powders, primers, and cases you have on hand. Record each lot separately — lot numbers carry through to sessions and printables."
                testid="components-empty"
              />
            </div>
          ) : (
            <table data-testid="components-inventory-table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Manufacturer</th>
                  <th>Model</th>
                  <th>Lot</th>
                  <th className="text-right">Qty on hand</th>
                  <th className="text-right">Est. used</th>
                  <th className="text-right">Loads</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((e) => (
                  <tr key={e.row.id} data-testid={`component-row-${e.row.id}`}>
                    <td>
                      <Badge>{e.row.kind}</Badge>
                    </td>
                    <td className="font-medium">
                      <Link
                        href={`/components/${e.row.id}`}
                        className="hover:text-accent"
                      >
                        {e.row.manufacturer}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/components/${e.row.id}`}
                        className="hover:text-accent"
                      >
                        {e.row.model}
                      </Link>
                    </td>
                    <td className="text-text-muted">{e.row.lotNumber ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {e.row.quantityOnHand != null ? (
                        <span className={e.low ? 'text-warning' : ''}>
                          {fmt(e.row.quantityOnHand)}
                          {e.row.unit ? ` ${e.row.unit}` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-right tabular-nums text-text-muted">
                      {formatUsageShort(e.row.kind, e.usage)}
                    </td>
                    <td className="text-right tabular-nums text-text-muted">
                      {e.linkedLoads}
                    </td>
                    <td className="text-text-muted">
                      {e.row.archived ? 'Archived' : e.low ? 'Low' : 'Active'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function formatUsageShort(
  kind: 'BULLET' | 'POWDER' | 'PRIMER' | 'CASE',
  usage: { shotsFired: number; powderLb: number | null },
): string {
  if (kind === 'POWDER') {
    if (usage.powderLb == null || usage.powderLb === 0) return '—';
    return `${fmt(usage.powderLb)} lb`;
  }
  if (usage.shotsFired === 0) return '—';
  return `${usage.shotsFired} ct`;
}
