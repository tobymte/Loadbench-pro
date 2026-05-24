import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { listDatasets } from '@/lib/validation/modelValidationDb';
import {
  DATASET_KINDS,
  VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE,
} from '@/lib/validation/modelValidation';
import { listAdapters } from '@/lib/ballistics/modelAdapter';
import {
  FEATURE_KEYS,
  getEntitlement,
} from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';

type SearchParams = { ok?: string; error?: string };

function UnauthorizedView({
  reason,
  premiumSafeSummary,
}: {
  reason: string | null;
  premiumSafeSummary?: { totalDatasets: number } | null;
}) {
  return (
    <>
      <Topbar
        title="Admin · Model validation"
        actions={<Badge tone="danger">Unauthorized</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
        <Card data-testid="model-validation-unauthorized">
          <CardHeader
            title="Admin access required"
            description="The model validation harness is admin-only. Pressure prediction remains disabled regardless of access state."
          />
          <CardBody>
            <p className="text-[13px] text-text-muted">
              {reason ?? 'You are not authorized to view this page.'}
            </p>
            <p className="text-[12px] text-text-faint mt-3">
              Add your Clerk-account email to the{' '}
              <code className="text-accent">LOADBENCH_ADMIN_EMAILS</code>{' '}
              comma-separated env var and redeploy / restart. For local dev
              without Clerk set{' '}
              <code className="text-accent">LOADBENCH_DISABLE_AUTH=true</code>.
            </p>
          </CardBody>
        </Card>

        {premiumSafeSummary && (
          <Card data-testid="model-validation-premium-summary">
            <CardHeader
              title="Premium safe summary"
              description="Premium (non-admin) accounts may see only this aggregate count. Reference cases, pressure values, and run outputs are admin-only."
            />
            <CardBody>
              <p className="text-[13px] text-text">
                Validation datasets in this workspace:{' '}
                <span className="font-semibold">
                  {premiumSafeSummary.totalDatasets}
                </span>
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

function NotConfiguredView({ message }: { message: string }) {
  return (
    <>
      <Topbar
        title="Admin · Model validation"
        actions={<Badge tone="warning">Setup required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
        <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2">
          <p>
            <strong className="font-semibold">
              Model validation workspace is not ready yet.
            </strong>{' '}
            The harness tables could not be queried.
          </p>
          <p className="text-[12px] text-text-muted">{message}</p>
          <p className="text-[12px] text-text-muted">
            Typical fixes: run{' '}
            <code className="text-accent">npx prisma migrate deploy</code>, then{' '}
            <code className="text-accent">npx prisma generate</code>, and
            confirm <code className="text-accent">DATABASE_URL</code> is set.
            Pressure prediction remains disabled regardless of setup state.
          </p>
        </div>
      </div>
    </>
  );
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error.';
  }
}

export default async function AdminModelValidationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const admin = await getAdminContext();

  let ctx: Awaited<ReturnType<typeof getWorkspaceContext>> | null = null;
  let workspaceError: string | null = null;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    workspaceError = describeError(e);
  }

  if (!admin.isAdmin) {
    // Premium non-admins (with the pressure_modeling entitlement) get a tiny
    // safe summary; everyone else just sees the unauthorized notice.
    let premiumSafeSummary: { totalDatasets: number } | null = null;
    if (ctx) {
      try {
        const e = await getEntitlement(
          ctx.workspaceId,
          FEATURE_KEYS.PRESSURE_MODELING,
        );
        if (e.hasAccess) {
          const datasets = await listDatasets(ctx.workspaceId);
          premiumSafeSummary = { totalDatasets: datasets.length };
        }
      } catch {
        // Ignore — keep summary null.
      }
    }
    return (
      <UnauthorizedView
        reason={admin.reason}
        premiumSafeSummary={premiumSafeSummary}
      />
    );
  }

  if (!ctx) {
    return <NotConfiguredView message={workspaceError ?? 'No workspace context.'} />;
  }

  let datasets: Awaited<ReturnType<typeof listDatasets>> = [];
  try {
    datasets = await listDatasets(ctx.workspaceId);
  } catch (e) {
    return <NotConfiguredView message={describeError(e)} />;
  }

  const adapters = listAdapters();

  return (
    <>
      <Topbar
        title="Admin · Model validation"
        actions={<Badge tone="accent">Operator</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            { label: 'Admin · Model validation' },
          ]}
        />

        {admin.viaLocalDevFallback && (
          <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[12px] text-text">
            <strong className="font-semibold">
              Local development fallback active.
            </strong>{' '}
            <code className="text-accent">LOADBENCH_DISABLE_AUTH=true</code> is
            set. Admin gating is bypassed.
          </div>
        )}

        {sp.ok && (
          <div className="rounded-md border border-success/40 bg-success-subtle px-4 py-3 text-[13px] text-text">
            {sp.ok}
          </div>
        )}
        {sp.error && (
          <div className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-3 text-[13px] text-text">
            {sp.error}
          </div>
        )}

        <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-1">
          <p>
            <strong className="font-semibold">
              Model validation is non-operational by design.
            </strong>{' '}
            The only adapter shipped (
            <code className="text-accent">disabled-default</code>) returns{' '}
            <code className="text-accent">pressurePredictionStatus: &quot;disabled&quot;</code>
            . No PSI, peak pressure, charge advice, or safe/unsafe verdict is
            ever produced. Reference pressure values stored on cases are
            admin-only validation metadata and are never rendered as guidance.
          </p>
          <p className="text-[12px] text-text-muted">
            See the <Link href="/safety" className="text-accent hover:text-accent-hover">safety policy</Link>
            {' '}and the README section on the adapter contract and validation
            process.
          </p>
        </div>

        <Card data-testid="adapter-registry-card">
          <CardHeader
            title="Adapter registry"
            description="Hardcoded, code-only. Adding an adapter requires a code change, review, and explicit governance sign-off."
          />
          <CardBody>
            <table className="w-full text-[12px]">
              <thead className="text-left text-text-faint">
                <tr>
                  <th className="py-1 pr-3 font-medium">Name</th>
                  <th className="py-1 pr-3 font-medium">Version</th>
                  <th className="py-1 pr-3 font-medium">Governance</th>
                  <th className="py-1 pr-3 font-medium">Blocked outputs</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {adapters.map((a) => (
                  <tr key={a.name} className="border-t border-border align-top">
                    <td className="py-1.5 pr-3"><code>{a.name}</code></td>
                    <td className="py-1.5 pr-3 text-text-muted">{a.version}</td>
                    <td className="py-1.5 pr-3">
                      <Badge
                        tone={a.governanceStatus === 'disabled' ? 'danger' : 'warning'}
                      >
                        {a.governanceStatus}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-3 text-text-muted">
                      {a.blockedOutputsPolicy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card data-testid="create-dataset-card">
          <CardHeader
            title="Create validation dataset"
            description="Group reference cases transcribed from a single source. Acknowledgement is required."
            actions={<Badge tone="accent">Admin</Badge>}
          />
          <CardBody>
            <form
              method="post"
              action="/api/admin/model-validation/datasets"
              className="space-y-3"
              data-testid="create-dataset-form"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Name</span>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Hodgdon 2024 — 6.5 Creedmoor H4350 max rows"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Kind</span>
                  <select
                    name="kind"
                    required
                    defaultValue="published"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  >
                    {DATASET_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Reference identifier (DOI, manual page, lab report id)</span>
                <input
                  name="referenceIdentifier"
                  type="text"
                  placeholder="e.g. https://hodgdon.com/... or LAB-2026-014"
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>License / attribution note</span>
                <textarea
                  name="licenseNote"
                  rows={2}
                  placeholder="e.g. transcribed from Hodgdon 2024 reloading manual, page 142."
                  className="px-2 py-1 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Description</span>
                <textarea
                  name="description"
                  rows={2}
                  className="px-2 py-1 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-text">
                <input
                  type="checkbox"
                  name="acknowledgedValidationOnly"
                  required
                />
                <span>
                  I confirm this is a validation-only dataset and will not be
                  used as load guidance.
                </span>
              </label>
              <div className="flex gap-2 pt-1">
                <Button type="submit">Create dataset</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card data-testid="datasets-list-card">
          <CardHeader
            title="Validation datasets"
            description="Click a dataset to view its cases and validation runs."
          />
          <CardBody>
            {datasets.length === 0 ? (
              <p className="text-[12px] text-text-muted">
                No validation datasets yet. Create one above to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-text-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Name</th>
                      <th className="py-1 pr-3 font-medium">Kind</th>
                      <th className="py-1 pr-3 font-medium">Status</th>
                      <th className="py-1 pr-3 font-medium">Cases</th>
                      <th className="py-1 pr-3 font-medium">Runs</th>
                      <th className="py-1 pr-3 font-medium">Updated</th>
                      <th className="py-1 pr-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {datasets.map((d) => (
                      <tr key={d.id} className="border-t border-border align-top">
                        <td className="py-1.5 pr-3">
                          <Link
                            href={`/admin/model-validation/${d.id}`}
                            className="text-accent hover:text-accent-hover"
                          >
                            {d.name}
                          </Link>
                          {d.referenceIdentifier && (
                            <div className="text-[11px] text-text-faint">
                              {d.referenceIdentifier}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-3">{d.kind}</td>
                        <td className="py-1.5 pr-3">
                          <Badge tone="neutral">{d.status}</Badge>
                        </td>
                        <td className="py-1.5 pr-3">{d._count.cases}</td>
                        <td className="py-1.5 pr-3">{d._count.runs}</td>
                        <td className="py-1.5 pr-3 text-text-muted">
                          {d.updatedAt.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-3">
                          <Link
                            href={`/admin/model-validation/${d.id}`}
                            className="text-accent hover:text-accent-hover"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              {VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE} Every run row carries{' '}
              <code className="text-accent">pressurePredictionStatus = &quot;disabled&quot;</code>{' '}
              in the audit log. The forbidden-output sanitizer rejects any
              adapter response containing PSI, peak pressure, chamber pressure,
              charge recommendations, safe / unsafe verdicts, or powder
              substitutions.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
