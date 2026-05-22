import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

// TODO(backend): fetch the load by id (scoped to workspace) and surface its
//   cartridge, bullet, powder, primer, case, source, and range sessions.

export default function LoadDetailPage({ params }: { params: { id: string } }) {
  return (
    <>
      <Topbar
        title={`Load ${params.id}`}
        actions={
          <>
            <Link href={`/api/loads/${params.id}/export`}>
              <Button size="sm" variant="secondary">
                Export JSON
              </Button>
            </Link>
            <Button size="sm" variant="secondary">
              Edit
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Load details"
            description="The complete record for this load."
            actions={<Badge tone="neutral">DRAFT</Badge>}
          />
          <CardBody>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <Detail label="Cartridge" value="—" />
              <Detail label="Bullet" value="—" />
              <Detail label="Powder" value="—" />
              <Detail label="Primer" value="—" />
              <Detail label="Charge (gr)" value="—" mono />
              <Detail label="OAL (in)" value="—" mono />
              <Detail label="Base→ogive (in)" value="—" mono />
              <Detail label="Neck tension (thou)" value="—" mono />
              <Detail label="Source" value="—" />
              <Detail label="Published max (gr)" value="—" mono />
              <Detail label="Safety acknowledged" value="—" />
              <Detail label="Rifle" value="—" />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Range sessions"
            description="Sessions where this load was shot."
            actions={<Button size="sm">Log session</Button>}
          />
          <CardBody>
            <p className="text-sm text-text-muted">
              No range sessions recorded against this load yet.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Audit history" description="Every change to this record is logged." />
          <CardBody>
            <p className="text-sm text-text-muted">No history yet.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-text-faint">{label}</dt>
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
