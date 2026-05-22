import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

// TODO(backend): fetch cartridges for the current workspace.
// import { prisma } from '@/lib/db/prisma';
// import { getWorkspaceContext } from '@/lib/auth/workspace';
// const ctx = await getWorkspaceContext();
// const rows = await prisma.cartridge.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: 'asc' } });

const ROWS: Array<{
  name: string;
  saami: string | null;
  bulletDiameterIn: number | null;
  maxPressurePsi: number | null;
}> = [];

export default function CartridgesPage() {
  return (
    <>
      <Topbar
        title="Cartridges"
        actions={<Button>New cartridge</Button>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Cartridge library"
            description="Reference data you maintain — SAAMI/CIP designation, bullet diameter, and the published max pressure for the cartridge."
          />
          {ROWS.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No cartridges yet"
                description="Add the cartridges you reload for. LoadBench Pro uses these as reference data when you record a load."
                action={<Button>Add a cartridge</Button>}
              />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SAAMI / CIP</th>
                  <th className="text-right">Bullet dia (in)</th>
                  <th className="text-right">Max pressure (psi)</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.name}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-text-muted">{r.saami ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {r.bulletDiameterIn ?? '—'}
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
