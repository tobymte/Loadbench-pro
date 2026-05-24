import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { InventoryAdjustForm } from '@/components/forms/InventoryAdjustForm';
import { InventorySettingsForm } from '@/components/forms/InventorySettingsForm';
import {
  estimateUsage,
  estimateRemaining,
  isLowStock,
  type LoadWithSessions,
} from '@/lib/analysis/componentUsage';

export const dynamic = 'force-dynamic';

const KIND_DEFAULT_UNIT: Record<string, string> = {
  BULLET: 'ct',
  POWDER: 'lb',
  PRIMER: 'ct',
  CASE: 'ct',
};

export default async function ComponentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getWorkspaceContext();
  const component = await prisma.component.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!component) {
    notFound();
  }

  const whereByKind =
    component.kind === 'BULLET'
      ? { bulletId: component.id }
      : component.kind === 'POWDER'
        ? { powderId: component.id }
        : component.kind === 'PRIMER'
          ? { primerId: component.id }
          : { caseId: component.id };

  const loads = await prisma.load.findMany({
    where: { workspaceId: ctx.workspaceId, ...whereByKind },
    select: {
      id: true,
      name: true,
      status: true,
      chargeGr: true,
      cartridge: { select: { id: true, name: true } },
      sessions: {
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          location: true,
          shotsFired: true,
          avgVelocityFps: true,
          esFps: true,
          sdFps: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const usageInput: LoadWithSessions[] = loads.map((l) => ({
    id: l.id,
    chargeGr: l.chargeGr,
    sessions: l.sessions,
  }));
  const usage = estimateUsage(component.kind, usageInput);
  const remaining = estimateRemaining(
    component.kind,
    component.quantityOnHand,
    component.unit,
    usage,
  );
  const low = isLowStock(component.quantityOnHand, component.lowStockThreshold);

  const usageLabel =
    component.kind === 'POWDER'
      ? 'Estimated powder consumed'
      : component.kind === 'CASE'
        ? 'Rounds loaded/fired'
        : 'Estimated rounds fired';

  return (
    <>
      <Topbar
        title={`${component.manufacturer} ${component.model}`}
        actions={
          <Link
            href="/components"
            className="text-[12px] text-text-muted hover:text-text"
          >
            ← All components
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Component"
            description="Reference metadata for this component."
            actions={
              <div className="flex items-center gap-2">
                <Badge>{component.kind}</Badge>
                {component.archived && <Badge tone="neutral">Archived</Badge>}
                {low && (
                  <Badge tone="warning" data-testid="component-low-badge">
                    Low stock
                  </Badge>
                )}
              </div>
            }
          />
          <CardBody>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <Detail label="Manufacturer" value={component.manufacturer} />
              <Detail label="Model" value={component.model} />
              <Detail label="Lot number" value={component.lotNumber ?? '—'} />
              <Detail
                label="Bullet weight (gr)"
                value={
                  component.bulletWeightGr != null
                    ? String(component.bulletWeightGr)
                    : '—'
                }
                mono
              />
              <Detail
                label="Bullet BC"
                value={
                  component.bulletBc != null ? String(component.bulletBc) : '—'
                }
                mono
              />
              <Detail
                label="Burn rate"
                value={component.burnRateLabel ?? '—'}
              />
              <Detail
                label="Quantity on hand"
                value={
                  component.quantityOnHand != null
                    ? `${component.quantityOnHand}${component.unit ? ' ' + component.unit : ''}`
                    : '—'
                }
                mono
              />
              <Detail
                label="Low-stock threshold"
                value={
                  component.lowStockThreshold != null
                    ? `${component.lowStockThreshold}${component.unit ? ' ' + component.unit : ''}`
                    : '—'
                }
                mono
              />
            </dl>
            {component.notes && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-text-faint">
                  Notes
                </div>
                <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">
                  {component.notes}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Inventory settings"
            description="Set quantity on hand, the unit you're tracking, low-stock threshold, and the lot number. This is recordkeeping only — not a physical-inventory audit."
          />
          <CardBody>
            <InventorySettingsForm
              componentId={component.id}
              initialQuantityOnHand={component.quantityOnHand}
              initialUnit={component.unit}
              initialLowStockThreshold={component.lowStockThreshold}
              initialLotNumber={component.lotNumber}
              defaultUnit={KIND_DEFAULT_UNIT[component.kind]}
            />
            <div className="mt-5 pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2">
                Quick adjustment
              </div>
              <InventoryAdjustForm
                componentId={component.id}
                unit={component.unit}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Usage estimate"
            description="Computed from the shotsFired and chargeGr you logged. Estimates are recordkeeping only — they are not a measurement of physical inventory."
          />
          <CardBody>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <Detail
                label={usageLabel}
                value={formatUsage(component.kind, usage)}
                mono
              />
              <Detail
                label="Linked loads"
                value={String(usage.linkedLoads)}
                mono
              />
              <Detail
                label="Sessions w/ shots"
                value={String(usage.linkedSessionsWithShots)}
                mono
              />
              <Detail
                label="Est. remaining"
                value={
                  remaining
                    ? `${formatRemaining(remaining.value)} ${remaining.unit}`
                    : '—'
                }
                mono
              />
            </dl>
            {component.kind === 'CASE' && (
              <p className="mt-4 text-[12px] text-text-faint">
                Note: case usage is shown as rounds loaded/fired, not case life
                remaining. Brass life depends on pressure history, annealing,
                trim/sizing — none of which this app models.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Linked loads"
            description="Loads that reference this component."
          />
          {loads.length === 0 ? (
            <CardBody>
              <p className="text-sm text-text-muted">
                No loads use this component yet.
              </p>
            </CardBody>
          ) : (
            <table data-testid="component-loads-table">
              <thead>
                <tr>
                  <th>Load</th>
                  <th>Cartridge</th>
                  <th>Status</th>
                  <th className="text-right">Charge (gr)</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Shots logged</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((l) => {
                  const shots = l.sessions.reduce(
                    (acc, s) => acc + (s.shotsFired ?? 0),
                    0,
                  );
                  return (
                    <tr key={l.id}>
                      <td className="font-medium">
                        <Link
                          href={`/loads/${l.id}`}
                          className="hover:text-accent"
                        >
                          {l.name}
                        </Link>
                      </td>
                      <td className="text-text-muted">
                        {l.cartridge?.name ?? '—'}
                      </td>
                      <td>
                        <Badge>{l.status}</Badge>
                      </td>
                      <td className="text-right tabular-nums">
                        {l.chargeGr ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {l.sessions.length}
                      </td>
                      <td className="text-right tabular-nums">{shots}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Sessions tied to these loads"
            description="Range sessions where loads using this component were shot."
          />
          {countSessions(loads) === 0 ? (
            <CardBody>
              <p className="text-sm text-text-muted">
                No range sessions recorded yet for loads using this component.
              </p>
            </CardBody>
          ) : (
            <table data-testid="component-sessions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Load</th>
                  <th>Location</th>
                  <th className="text-right">Shots</th>
                  <th className="text-right">Avg vel (fps)</th>
                  <th className="text-right">ES</th>
                  <th className="text-right">SD</th>
                </tr>
              </thead>
              <tbody>
                {loads
                  .flatMap((l) =>
                    l.sessions.map((s) => ({ ...s, loadName: l.name })),
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .map((s) => (
                    <tr key={s.id}>
                      <td className="text-text-muted">
                        {new Date(s.date).toLocaleDateString()}
                      </td>
                      <td>{s.loadName}</td>
                      <td className="text-text-muted">
                        {s.location ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {s.shotsFired ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {s.avgVelocityFps ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {s.esFps ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {s.sdFps ?? '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              Inventory and usage estimates on this page are recordkeeping only.
              They are derived from the data you entered against your own loads
              and range sessions, and are not a guarantee of physical inventory
              or component life remaining. LoadBench Pro does not recommend
              charges, substitutions, or “safe load” claims.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function countSessions(loads: Array<{ sessions: unknown[] }>): number {
  let n = 0;
  for (const l of loads) n += l.sessions.length;
  return n;
}

function formatUsage(
  kind: 'BULLET' | 'POWDER' | 'PRIMER' | 'CASE',
  usage: {
    shotsFired: number;
    powderLb: number | null;
    powderGr: number | null;
  },
): string {
  if (kind === 'POWDER') {
    if (usage.powderGr == null || usage.powderGr === 0) return '—';
    const lb = (usage.powderGr / 7000).toFixed(3);
    return `${usage.powderGr.toFixed(1)} gr (${lb} lb)`;
  }
  return `${usage.shotsFired} ct`;
}

function formatRemaining(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </dt>
      <dd
        className={
          'mt-1 text-text ' + (mono ? 'font-mono tabular-nums' : 'font-medium')
        }
      >
        {value}
      </dd>
    </div>
  );
}
