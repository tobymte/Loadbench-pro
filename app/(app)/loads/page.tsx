import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

// TODO(backend): fetch loads scoped to workspace, with bullet/powder/cartridge joins.

type LoadRow = {
  id: string;
  name: string;
  cartridge: string;
  bullet: string;
  powder: string;
  chargeGr: number | null;
  status: 'DRAFT' | 'PLANNED' | 'LOADED' | 'TESTED' | 'ARCHIVED';
  source: string | null;
};

const ROWS: LoadRow[] = [];

export default function LoadsPage() {
  return (
    <>
      <Topbar
        title="Loads"
        actions={
          <Link href="/loads/new">
            <Button>New load</Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="All loads"
            description="Every load you have recorded. Status reflects what you have entered, not whether the load is safe."
          />
          {ROWS.length === 0 ? (
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
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cartridge</th>
                  <th>Bullet</th>
                  <th>Powder</th>
                  <th className="text-right">Charge (gr)</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/loads/${r.id}`}
                        className="text-accent hover:text-accent-hover"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="text-text-muted">{r.cartridge}</td>
                    <td className="text-text-muted">{r.bullet}</td>
                    <td className="text-text-muted">{r.powder}</td>
                    <td className="text-right tabular-nums">
                      {r.chargeGr ?? '—'}
                    </td>
                    <td className="text-text-muted">{r.source ?? '—'}</td>
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
