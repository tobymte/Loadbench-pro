import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CartridgeForm } from '@/components/forms/CartridgeForm';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function CartridgesPage() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.cartridge.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      saami: true,
      bulletDiameterIn: true,
      caseCapacityGrH2O: true,
      maxPressurePsi: true,
    },
  });

  return (
    <>
      <Topbar title="Cartridges" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <CartridgeForm />

        <Card>
          <CardHeader
            title="Cartridge library"
            description="Reference data you maintain — SAAMI/CIP designation, bullet diameter, and the published max pressure for the cartridge."
          />
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No cartridges yet"
                description="Add the cartridges you reload for. LoadBench Pro uses these as reference data when you record a load."
              />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SAAMI / CIP</th>
                  <th className="text-right">Bullet dia (in)</th>
                  <th className="text-right">Case cap (gr H₂O)</th>
                  <th className="text-right">Max pressure (psi)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-text-muted">{r.saami ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {r.bulletDiameterIn ?? '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.caseCapacityGrH2O ?? '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.maxPressurePsi ?? '—'}
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
