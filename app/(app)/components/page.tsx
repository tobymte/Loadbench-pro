import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ComponentForm } from '@/components/forms/ComponentForm';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function ComponentsPage() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.component.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ kind: 'asc' }, { manufacturer: 'asc' }, { model: 'asc' }],
    select: {
      id: true,
      kind: true,
      manufacturer: true,
      model: true,
      bulletWeightGr: true,
      bulletBc: true,
      burnRateLabel: true,
      lotNumber: true,
      archived: true,
    },
  });

  return (
    <>
      <Topbar title="Components" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <ComponentForm />

        <Card>
          <CardHeader
            title="Component inventory"
            description="Track each lot of each component. Lot numbers matter — record them when you record a session. LoadBench Pro does not recommend substitutions or load data."
          />
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No components recorded yet"
                description="Start by adding the bullets, powders, primers, and cases you have on hand."
              />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Manufacturer</th>
                  <th>Model</th>
                  <th>Lot</th>
                  <th className="text-right">Weight (gr)</th>
                  <th className="text-right">BC</th>
                  <th>Burn rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Badge>{r.kind}</Badge>
                    </td>
                    <td className="font-medium">{r.manufacturer}</td>
                    <td>{r.model}</td>
                    <td className="text-text-muted">{r.lotNumber ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {r.bulletWeightGr ?? '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.bulletBc ?? '—'}
                    </td>
                    <td className="text-text-muted">
                      {r.burnRateLabel ?? '—'}
                    </td>
                    <td className="text-text-muted">
                      {r.archived ? 'Archived' : 'Active'}
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
