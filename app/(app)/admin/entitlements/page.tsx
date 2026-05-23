import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getAdminContext } from '@/lib/auth/admin';
import {
  listEntitlementsForAdmin,
  listManualEntitlementAudit,
  type ManualEntitlementRow,
  type ManualEntitlementAuditRow,
} from '@/lib/billing/manualEntitlement';

// /admin/entitlements
//
// Operator-only manual override for the `pressure_modeling` entitlement.
// Lets the app owner grant or revoke premium access while BigCommerce
// payments are not yet configured. Non-admins see an unauthorized notice
// (HTTP 200 with a graceful message — not a server error / 500).
//
// SAFETY: granting a manual entitlement only unlocks the pressure-engine
// display scaffolding. It does NOT enable pressure predictions, charge
// recommendations, or any safe/unsafe verdict — those remain blocked by
// the engine's hardcoded `pressurePredictionStatus = "disabled"` guardrail.

export const dynamic = 'force-dynamic';

type SearchParams = { ok?: string; error?: string };

export default async function AdminEntitlementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = await getAdminContext();

  if (!admin.isAdmin) {
    return (
      <>
        <Topbar
          title="Admin · Entitlements"
          actions={<Badge tone="danger">Unauthorized</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
          <Card data-testid="admin-entitlements-unauthorized">
            <CardHeader
              title="Admin access required"
              description="This page is only available to operators listed in LOADBENCH_ADMIN_EMAILS."
            />
            <CardBody>
              <p className="text-[13px] text-text-muted">
                {admin.reason ??
                  'You are not authorized to view manual entitlement controls.'}
              </p>
              <p className="text-[12px] text-text-faint mt-3">
                Add your Clerk-account email (case-insensitive) to the{' '}
                <code className="text-accent">LOADBENCH_ADMIN_EMAILS</code>{' '}
                comma-separated env var, then redeploy / restart the server.
                For local development without Clerk, set{' '}
                <code className="text-accent">LOADBENCH_DISABLE_AUTH=true</code>
                .
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  let entitlements: ManualEntitlementRow[] = [];
  let audit: ManualEntitlementAuditRow[] = [];
  let loadError: string | null = null;
  try {
    [entitlements, audit] = await Promise.all([
      listEntitlementsForAdmin(),
      listManualEntitlementAudit(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Unknown error';
  }

  return (
    <>
      <Topbar
        title="Admin · Entitlements"
        actions={<Badge tone="accent">Operator</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {admin.viaLocalDevFallback && (
          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[12px] text-text"
            data-testid="admin-local-dev-banner"
          >
            <strong className="font-semibold">
              Local development fallback active.
            </strong>{' '}
            <code className="text-accent">LOADBENCH_DISABLE_AUTH=true</code>{' '}
            is set, so admin gating is bypassed. Unset this variable and
            populate <code className="text-accent">LOADBENCH_ADMIN_EMAILS</code>{' '}
            before deploying.
          </div>
        )}

        {searchParams.ok && (
          <div
            className="rounded-md border border-success/40 bg-success-subtle px-4 py-3 text-[13px] text-text"
            data-testid="admin-entitlements-ok"
          >
            {searchParams.ok}
          </div>
        )}
        {searchParams.error && (
          <div
            className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-3 text-[13px] text-text"
            data-testid="admin-entitlements-error"
          >
            {searchParams.error}
          </div>
        )}

        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
          data-testid="admin-safety-banner"
        >
          <strong className="font-semibold">
            Manual entitlement does not enable load advice.
          </strong>{' '}
          Granting <code className="text-accent">pressure_modeling</code>{' '}
          unlocks the non-operational pressure-engine display scaffolding
          only. Pressure prediction, charge recommendations, and any
          safe/unsafe verdict remain disabled regardless of entitlement.
        </div>

        <Card data-testid="admin-grant-card">
          <CardHeader
            title="Grant or revoke pressure_modeling"
            description="Identify a workspace by id, slug, or a user's email. Leave both blank to act on the current operator workspace. Reason is optional and recorded in the audit log."
            actions={<Badge tone="accent">Manual</Badge>}
          />
          <CardBody>
            <form
              method="post"
              action="/api/admin/entitlements"
              className="space-y-3"
              data-testid="admin-grant-form"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Workspace id or slug</span>
                  <input
                    name="workspaceId"
                    type="text"
                    placeholder="cu… or workspace-…"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>User email (resolves to first workspace)</span>
                  <input
                    name="email"
                    type="email"
                    placeholder="customer@example.com"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Reason (audit trail)</span>
                <input
                  name="reason"
                  type="text"
                  placeholder="e.g. comped beta tester, refunded order #1234"
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" name="op" value="grant">
                  Grant pressure_modeling
                </Button>
                <Button
                  type="submit"
                  name="op"
                  value="revoke"
                  variant="danger"
                >
                  Revoke pressure_modeling
                </Button>
              </div>
              <p className="text-[11px] text-text-faint">
                Acting as <code className="text-accent">{admin.email}</code>.
                Every action writes an AuditEvent row tagged{' '}
                <code className="text-accent">manual_entitlement.grant</code>{' '}
                or <code className="text-accent">manual_entitlement.revoke</code>.
              </p>
            </form>
          </CardBody>
        </Card>

        <Card data-testid="admin-entitlements-list">
          <CardHeader
            title="Current entitlements"
            description="Most recent 200 rows across all workspaces. Manual grants are tagged in the Source column."
          />
          <CardBody>
            {loadError ? (
              <p className="text-[12px] text-danger">{loadError}</p>
            ) : entitlements.length === 0 ? (
              <p className="text-[12px] text-text-muted">
                No entitlement rows yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-text-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Workspace</th>
                      <th className="py-1 pr-3 font-medium">Feature</th>
                      <th className="py-1 pr-3 font-medium">Status</th>
                      <th className="py-1 pr-3 font-medium">Source</th>
                      <th className="py-1 pr-3 font-medium">Updated</th>
                      <th className="py-1 pr-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {entitlements.map((e) => (
                      <tr
                        key={e.id}
                        className="border-t border-border align-top"
                      >
                        <td className="py-1.5 pr-3">
                          <div>{e.workspaceName}</div>
                          <div className="text-text-faint text-[11px]">
                            {e.workspaceSlug} · {e.workspaceId}
                          </div>
                        </td>
                        <td className="py-1.5 pr-3">
                          <code>{e.featureKey}</code>
                        </td>
                        <td className="py-1.5 pr-3">{e.status}</td>
                        <td className="py-1.5 pr-3">
                          {e.isManual ? (
                            <span>
                              <Badge tone="accent">manual</Badge>
                              {e.manualGrantedBy && (
                                <span className="ml-1 text-text-faint">
                                  by {e.manualGrantedBy}
                                </span>
                              )}
                            </span>
                          ) : e.bigcommerceOrderId ? (
                            <span>
                              <Badge tone="neutral">bigcommerce</Badge>
                              <span className="ml-1 text-text-faint">
                                #{e.bigcommerceOrderId}
                              </span>
                            </span>
                          ) : (
                            <Badge tone="neutral">none</Badge>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-text-muted">
                          {e.updatedAt.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-3">
                          <form
                            method="post"
                            action="/api/admin/entitlements"
                            className="flex gap-1"
                          >
                            <input
                              type="hidden"
                              name="workspaceId"
                              value={e.workspaceId}
                            />
                            {e.status === 'ACTIVE' ? (
                              <Button
                                type="submit"
                                name="op"
                                value="revoke"
                                variant="danger"
                                size="sm"
                              >
                                Revoke
                              </Button>
                            ) : (
                              <Button
                                type="submit"
                                name="op"
                                value="grant"
                                size="sm"
                              >
                                Grant
                              </Button>
                            )}
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card data-testid="admin-audit-log">
          <CardHeader
            title="Recent manual-entitlement audit events"
            description="Most recent 50 grant / revoke actions. Stored as AuditEvent rows under entityType = WorkspaceEntitlement."
          />
          <CardBody>
            {audit.length === 0 ? (
              <p className="text-[12px] text-text-muted">
                No manual entitlement audit events yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-text-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">When</th>
                      <th className="py-1 pr-3 font-medium">Action</th>
                      <th className="py-1 pr-3 font-medium">Admin</th>
                      <th className="py-1 pr-3 font-medium">Workspace</th>
                      <th className="py-1 pr-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {audit.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="py-1.5 pr-3 text-text-muted">
                          {a.createdAt.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-3">
                          <code>{a.action}</code>
                        </td>
                        <td className="py-1.5 pr-3">
                          {a.adminEmail ?? <span className="text-text-faint">—</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-text-muted">
                          {a.workspaceId}
                        </td>
                        <td className="py-1.5 pr-3 text-text-muted">
                          {a.reason ?? <span className="text-text-faint">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
