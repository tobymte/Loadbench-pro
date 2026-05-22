import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function DataToolsPage() {
  return (
    <>
      <Topbar title="Data tools" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader
              title="Export"
              description="Download a JSON snapshot of your workspace. Useful for backup and for moving data between machines."
            />
            <CardBody className="flex items-center gap-3">
              <Link href="/api/export">
                <Button>Export workspace JSON</Button>
              </Link>
              <span className="text-xs text-text-muted">
                Includes cartridges, components, loads, sessions, and sources.
              </span>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Import"
              description="Bring data in from a CSV or JSON file. Each row is staged in an ImportBatch and reviewed before commit."
            />
            <CardBody className="space-y-3">
              <Button variant="secondary" disabled>
                Choose file…
              </Button>
              <p className="text-xs text-text-muted">
                {/* TODO(backend): implement /api/import endpoint that stores
                    an ImportBatch + ImportBatchRow set for review. */}
                Imports are queued as ImportBatches so errors can be inspected
                row-by-row before commit.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Audit log"
              description="Every create / update / delete / export is recorded."
            />
            <CardBody>
              <p className="text-sm text-text-muted">
                {/* TODO(backend): list recent AuditEvent rows for the workspace */}
                No audit events recorded yet.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Print jobs"
              description="Load cards and session reports queued for printing."
            />
            <CardBody>
              <p className="text-sm text-text-muted">
                {/* TODO(backend): list recent PrintJob rows */}
                No print jobs.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
