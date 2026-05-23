import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function LoadsPage() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.load.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: {
      cartridge: { select: { name: true } },
      bullet: { select: { manufacturer: true, model: true } },
      powder: { select: { manufacturer: true, model: true } },
      source: { select: { title: true } },
    },
  });

  return (
    <>
      <Topbar
        title="Loads"
        actions={
          <Link href="/loads/new">
            <Button data-testid="loads-new">New load</Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="All loads"
            description="Every load you have recorded. Status reflects what you have entered, not whether the load is safe."
          />
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No loads recorded yet"
                description="Record a load to start your notebook. Charges cannot be saved without a cited published source and your safety acknowledgement."
                action={
                  <Link href="/loads/new">
                    <Button>New load</Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <table data-testid="loads-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cartridge</th>
                  <th>Bullet</th>
                  <th>Powder</th>
                  <th className="text-right">Charge (gr)</th>
                  <th className="text-right">Published max (row, gr)</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/loads/${r.id}`}
                        className="text-accent hover:text-accent-hover"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="text-text-muted">{r.cartridge?.name ?? '—'}</td>
                    <td className="text-text-muted">
                      {r.bullet ? `${r.bullet.manufacturer} ${r.bullet.model}` : '—'}
                    </td>
                    <td className="text-text-muted">
                      {r.powder ? `${r.powder.manufacturer} ${r.powder.model}` : '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.chargeGr ?? '—'}
                    </td>
                    <td
                      className="text-right tabular-nums"
                      data-testid={`loads-row-${r.id}-row-published-max`}
                    >
                      {r.publishedMaxChargeGr ?? '—'}
                    </td>
                    <td className="text-text-muted">{r.source?.title ?? '—'}</td>
                    <td>
                      <Badge
                        tone={
                          r.status === 'TESTED'
                            ? 'success'
                            : r.status === 'LOADED'
                              ? 'accent'
                              : 'neutral'
                        }
                      >
                        {r.status}
                      </Badge>
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
