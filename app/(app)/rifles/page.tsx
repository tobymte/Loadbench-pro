import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RifleForm } from '@/components/forms/RifleForm';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function RiflesPage() {
  const ctx = await getWorkspaceContext();

  const [rifles, cartridges] = await Promise.all([
    prisma.rifle.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      include: {
        cartridge: { select: { name: true } },
        _count: { select: { sessions: true, loads: true } },
      },
    }),
    prisma.cartridge.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <Topbar title="Rifles" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <RifleForm
          options={{
            cartridges: cartridges.map((c) => ({ value: c.id, label: c.name })),
          }}
        />

        <Card>
          <CardHeader
            title="Rifle profiles"
            description="Workspace-scoped rifles. Profiles are recordkeeping only — values stored here do not validate loads or imply pressure safety."
          />
          {rifles.length === 0 ? (
            <div className="p-5">
              <EmptyState
                tone="accent"
                title="No rifles yet"
                description="Add a rifle profile so range sessions and loads can be tagged to a specific barrel. Barrel length, twist, and zero help downstream filters and printables."
                testid="rifles-empty"
              />
            </div>
          ) : (
            <table data-testid="rifles-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cartridge</th>
                  <th>Manufacturer</th>
                  <th>Model</th>
                  <th className="text-right">Barrel (in)</th>
                  <th>Twist</th>
                  <th className="text-right">Zero (yd)</th>
                  <th>Optic</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Loads</th>
                </tr>
              </thead>
              <tbody>
                {rifles.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-text-muted">{r.cartridge?.name ?? '—'}</td>
                    <td className="text-text-muted">{r.manufacturer ?? '—'}</td>
                    <td className="text-text-muted">{r.model ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {r.barrelLengthIn ?? '—'}
                    </td>
                    <td className="text-text-muted">{r.twistRate ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {r.zeroDistanceYd ?? '—'}
                    </td>
                    <td className="text-text-muted">{r.opticNotes ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {r._count.sessions}
                    </td>
                    <td className="text-right tabular-nums">{r._count.loads}</td>
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
