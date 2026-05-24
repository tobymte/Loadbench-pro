import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getAdminContext } from '@/lib/auth/admin';

// /data-tools
//
// Workspace export & bulk-operations hub. CSV downloads are served from
// /api/export/csv/[entity] and JSON snapshot from /api/export.

type ExportRow = {
  label: string;
  href: string;
  description: string;
  adminOnly?: boolean;
};

const USER_EXPORTS: ExportRow[] = [
  {
    label: 'Cartridges',
    href: '/api/export/csv/cartridges',
    description: 'Cartridge reference data.',
  },
  {
    label: 'Components & inventory',
    href: '/api/export/csv/components',
    description: 'Bullets, powders, primers, cases with lot numbers and stock.',
  },
  {
    label: 'Loads',
    href: '/api/export/csv/loads',
    description: 'Charge data, citations, acknowledgements, and notes.',
  },
  {
    label: 'Sources',
    href: '/api/export/csv/sources',
    description: 'Published references you cite on loads.',
  },
  {
    label: 'Rifles',
    href: '/api/export/csv/rifles',
    description: 'Rifle profiles.',
  },
  {
    label: 'Range sessions',
    href: '/api/export/csv/sessions',
    description: 'Observed velocity, ES/SD, group size, and conditions.',
  },
  {
    label: 'Published-data rows',
    href: '/api/export/csv/published-rows',
    description: 'Staged and verified rows from the published-data review queue.',
  },
  {
    label: 'Solver inputs',
    href: '/api/export/csv/solver-inputs',
    description: 'Case capacity, bullet dim, powder, barrel, and chrono calibration records.',
  },
  {
    label: 'Pressure-engine run metadata',
    href: '/api/export/csv/pressure-runs',
    description: 'Validation-only runs. No PSI, no charge advice — velocity delta only.',
  },
];

const ADMIN_EXPORTS: ExportRow[] = [
  {
    label: 'Model validation datasets',
    href: '/api/export/csv/validation-datasets',
    description: 'Admin reference datasets.',
    adminOnly: true,
  },
  {
    label: 'Model validation cases',
    href: '/api/export/csv/validation-cases',
    description: 'Admin reference cases.',
    adminOnly: true,
  },
  {
    label: 'Model validation runs',
    href: '/api/export/csv/validation-runs',
    description: 'Adapter-vs-reference validation runs.',
    adminOnly: true,
  },
];

export default async function DataToolsPage() {
  const admin = await getAdminContext();

  return (
    <>
      <Topbar
        title="Data tools"
        actions={<Badge tone="neutral">Backup & portability</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Backup the whole workspace"
            description="JSON snapshot of every record in your workspace. Useful for moving between machines or keeping a periodic backup."
          />
          <CardBody className="flex flex-wrap items-center gap-3">
            <Link href="/api/export">
              <Button>Download JSON snapshot</Button>
            </Link>
            <span className="text-[12px] text-text-muted">
              Includes cartridges, components, loads, sessions, rifles, and sources.
            </span>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="CSV exports"
            description="Download a single entity as a UTF-8 CSV. Open in Excel, Numbers, Google Sheets, or any text editor. Workspace-scoped — your workspace only."
          />
          <CardBody className="!p-0">
            <ul className="divide-y divide-border">
              {USER_EXPORTS.map((row) => (
                <li
                  key={row.href}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text">{row.label}</div>
                    <div className="text-[12px] text-text-muted">{row.description}</div>
                  </div>
                  <Link href={row.href}>
                    <Button size="sm" variant="secondary">
                      Download CSV
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {admin.isAdmin && (
          <Card>
            <CardHeader
              title="Admin exports"
              description="Operator-only. Includes governance datasets used by the model validation harness. These exports contain user-entered reference data only and never contain pressure predictions."
              actions={<Badge tone="warning">Operator-only</Badge>}
            />
            <CardBody className="!p-0">
              <ul className="divide-y divide-border">
                {ADMIN_EXPORTS.map((row) => (
                  <li
                    key={row.href}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text">{row.label}</div>
                      <div className="text-[12px] text-text-muted">{row.description}</div>
                    </div>
                    <Link href={row.href}>
                      <Button size="sm" variant="secondary">
                        Download CSV
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Import"
            description="Bring data in from a CSV or JSON file via the Guided data import wizard."
          />
          <CardBody className="flex flex-wrap gap-2 items-center">
            <Link href="/data-import">
              <Button variant="secondary">Open guided data import →</Button>
            </Link>
            <span className="text-[12px] text-text-muted">
              Each batch is staged in an ImportBatch and reviewed before commit.
            </span>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="What is excluded from exports"
            description="LoadBench Pro never exports secrets, API keys, Clerk session material, or admin-only configuration."
          />
          <CardBody>
            <ul className="list-disc pl-5 text-[12px] text-text-muted space-y-1">
              <li>No environment variables or runtime secrets.</li>
              <li>No pressure predictions or charge recommendations — those do not exist in the database.</li>
              <li>No other workspaces — exports are scoped to your workspace via the workspace context.</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
