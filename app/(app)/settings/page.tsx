import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { getAdminContext } from '@/lib/auth/admin';
import { FEATURE_KEYS, getEntitlement } from '@/lib/billing/entitlements';

// /settings
//
// Workspace + account settings. Reads workspace identity and entitlement
// state from the database when reachable. Falls back gracefully when the
// database is unavailable so this page never hard-fails — useful for
// debugging deployments.

export const dynamic = 'force-dynamic';

type SettingsView =
  | {
      ok: true;
      workspaceName: string;
      workspaceSlug: string;
      memberCount: number;
      role: string;
      pressureAccess: boolean;
      pressureStatus: string | null;
    }
  | { ok: false; message: string };

async function loadSettings(): Promise<SettingsView> {
  try {
    const ctx = await getWorkspaceContext();
    const workspace = await prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { name: true, slug: true, _count: { select: { members: true } } },
    });
    const ent = await getEntitlement(ctx.workspaceId, FEATURE_KEYS.PRESSURE_MODELING).catch(
      () => null,
    );
    return {
      ok: true,
      workspaceName: workspace?.name ?? 'Unnamed workspace',
      workspaceSlug: workspace?.slug ?? '—',
      memberCount: workspace?._count.members ?? 1,
      role: ctx.role,
      pressureAccess: !!ent?.hasAccess,
      pressureStatus: ent?.status ?? null,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Settings unavailable.',
    };
  }
}

const UNIT_OPTIONS = [
  { value: 'imperial', label: 'Imperial (gr, fps, in, yd)' },
  { value: 'metric', label: 'Metric (g, m/s, mm, m)' },
];

export default async function SettingsPage() {
  const view = await loadSettings();
  const admin = await getAdminContext();

  if (!view.ok) {
    return (
      <>
        <Topbar
          title="Settings"
          actions={<Badge tone="warning">Setup required</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          <Card>
            <CardHeader
              title="Settings are unavailable"
              description="LoadBench Pro could not read your workspace from the database. The deployment guide explains the variables needed to make this work."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted mb-3">{view.message}</p>
              <Link href="/settings/deployment">
                <Button variant="secondary">Open deployment guide</Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Settings" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Workspace"
            description="Workspace details apply to every member. Editing is read-only in this build — the values reflect what is in the database."
          />
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="ws-name"
              label="Name"
              value={view.workspaceName}
              hint="Workspace display name."
            />
            <Field
              id="ws-slug"
              label="Slug"
              value={view.workspaceSlug}
              hint="Stable identifier in URLs and exports."
            />
            <Field
              id="ws-members"
              label="Members"
              value={String(view.memberCount)}
              hint="Workspace member count (read-only)."
            />
            <Field
              id="ws-role"
              label="Your role"
              value={view.role}
              hint="Derived from your workspace membership."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Units & preferences"
            description="These selectors are stored locally in your browser. They do not change any saved data — only how new values are displayed."
          />
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocalSelect
              storageKey="loadbench.units.charge"
              label="Charge / mass units"
              options={UNIT_OPTIONS}
            />
            <LocalSelect
              storageKey="loadbench.units.velocity"
              label="Velocity units"
              options={[
                { value: 'fps', label: 'Feet per second (fps)' },
                { value: 'mps', label: 'Meters per second (m/s)' },
              ]}
            />
            <LocalSelect
              storageKey="loadbench.units.distance"
              label="Distance units"
              options={[
                { value: 'yd', label: 'Yards' },
                { value: 'm', label: 'Meters' },
              ]}
            />
            <LocalSelect
              storageKey="loadbench.print.style"
              label="Print preference"
              options={[
                { value: 'compact', label: 'Compact (4 cards / page)' },
                { value: 'detailed', label: 'Detailed (1 card / page)' },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Pressure-engine access"
            description="Premium pressure-engine workspace is a validation surface only. It records data completeness and a velocity-only delta. It does not predict pressure, recommend charges, or return safety verdicts."
          />
          <CardBody>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge tone={view.pressureAccess ? 'success' : 'neutral'}>
                {view.pressureAccess ? 'Active' : 'Locked'}
              </Badge>
              {view.pressureStatus && (
                <span className="text-[12px] text-text-muted">
                  Status: {view.pressureStatus}
                </span>
              )}
              <Link
                href="/pressure-engine"
                className="text-[12px] text-accent hover:text-accent-hover"
              >
                Open pressure-engine →
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Account"
            description="Account management is handled by Clerk."
          />
          <CardBody>
            <p className="text-[13px] text-text-muted">
              Use the Clerk user menu in the top-right (when enabled) or visit{' '}
              <code className="text-accent">/sign-in</code> to switch accounts.
              LoadBench Pro never stores your password or email beyond the Clerk-mirrored profile.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Deployment & operations"
            description="Production setup, environment variables, and operator diagnostics."
          />
          <CardBody className="flex flex-wrap gap-2">
            <Link href="/settings/deployment">
              <Button variant="secondary">Deployment guide</Button>
            </Link>
            {admin.isAdmin && (
              <>
                <Link href="/admin/deployment-check">
                  <Button variant="secondary">Operator diagnostics</Button>
                </Link>
                <Link href="/admin/entitlements">
                  <Button variant="secondary">Entitlements</Button>
                </Link>
                <Link href="/admin/beta">
                  <Button variant="secondary">Beta package</Button>
                </Link>
              </>
            )}
            <Link href="/data-tools">
              <Button variant="secondary">Export & backup</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Field({
  id,
  label,
  value,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </label>
      <input
        id={id}
        readOnly
        value={value}
        className="rounded border border-border bg-bg-inset px-2.5 py-1.5 text-[13px] text-text"
      />
      {hint && <span className="text-[11px] text-text-faint">{hint}</span>}
    </div>
  );
}

function LocalSelect({
  storageKey,
  label,
  options,
}: {
  storageKey: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </label>
      <select
        defaultValue={options[0]?.value}
        data-localstorage-key={storageKey}
        className="rounded border border-border bg-bg-inset px-2.5 py-1.5 text-[13px] text-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-text-faint">
        Saved to your browser ({storageKey}).
      </span>
    </div>
  );
}
