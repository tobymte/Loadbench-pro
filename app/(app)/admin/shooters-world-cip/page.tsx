import React from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { listAllCipRecords } from '@/lib/validation/cipReferenceDb';
import { listAdapters } from '@/lib/ballistics/modelAdapter';
import {
  CIP_PRESSURE_UNITS,
  CIP_VOLUME_UNITS,
  CIP_VERIFICATION_STATUSES,
  CIP_SAFETY_BOUNDARY_MESSAGE,
  CIP_PRESSURE_PREDICTION_STATUS,
  formatPmax,
  formatVolume,
  statusBadgeTone,
} from '@/lib/validation/cipReference';
import { CipRowEditor } from './CipRowEditor';
import { CipBulkVerifyControls } from './CipBulkVerifyControls';

export const dynamic = 'force-dynamic';

type SearchParams = {
  ok?: string;
  error?: string;
  status?: string;
  cartridge?: string;
};

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error.';
  }
}

function UnauthorizedView({ reason }: { reason: string | null }) {
  return (
    <>
      <Topbar
        title="Admin · Shooters World / CIP"
        actions={<Badge tone="danger">Unauthorized</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
        <Card data-testid="cip-admin-unauthorized">
          <CardHeader
            title="Admin access required"
            description="The CIP reference entry workspace is admin-only. Pressure prediction remains disabled regardless of access state."
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
            <p className="text-[12px] text-text-faint mt-3">
              Non-admins can still browse the verified rows at{' '}
              <Link
                href="/cip-reference"
                className="text-accent hover:text-accent-hover"
              >
                /cip-reference
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function NotConfiguredView({ message }: { message: string }) {
  return (
    <>
      <Topbar
        title="Admin · Shooters World / CIP"
        actions={<Badge tone="warning">Setup required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
        <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-2">
          <p>
            <strong className="font-semibold">
              CIP reference workspace is not ready yet.
            </strong>{' '}
            The reference table could not be queried.
          </p>
          <p className="text-[12px] text-text-muted">{message}</p>
          <p className="text-[12px] text-text-muted">
            Typical fixes: run{' '}
            <code className="text-accent">npx prisma migrate deploy</code>,
            then <code className="text-accent">npx prisma generate</code>,
            and confirm{' '}
            <code className="text-accent">DATABASE_URL</code> is set.
            Pressure prediction remains disabled regardless of setup state.
          </p>
        </div>
      </div>
    </>
  );
}

export default async function AdminCipReferencePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const admin = await getAdminContext();

  if (!admin.isAdmin) {
    return <UnauthorizedView reason={admin.reason} />;
  }

  let ctx: Awaited<ReturnType<typeof getWorkspaceContext>> | null = null;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    return <NotConfiguredView message={describeError(e)} />;
  }

  let rows: Awaited<ReturnType<typeof listAllCipRecords>> = [];
  try {
    rows = await listAllCipRecords(ctx.workspaceId, {
      status:
        sp.status && (CIP_VERIFICATION_STATUSES as readonly string[]).includes(sp.status)
          ? (sp.status as (typeof CIP_VERIFICATION_STATUSES)[number])
          : null,
      cartridge: sp.cartridge?.trim() || null,
    });
  } catch (e) {
    return <NotConfiguredView message={describeError(e)} />;
  }

  const adapters = listAdapters();
  const swAdapter = adapters.find((a) => a.name === 'shooters-world-cip');

  // Rows that are eligible for bulk verify in this listing. We exclude
  // RETIRED outright (safest default — restoring requires the existing
  // single-row flow) and already-VERIFIED rows (idempotent no-op). We do NOT
  // exclude rows that are missing sourceUrl from the checkbox column — the
  // admin can still tick them and the API will skip them with a row-level
  // reason. Surfacing the "missing sourceUrl" badge in the row lets the
  // admin decide whether to fix-then-bulk-verify or just exclude them.
  const bulkEligibleRows = rows.filter(
    (r) =>
      r.verificationStatus === 'DRAFT' ||
      r.verificationStatus === 'PENDING_REVIEW',
  );
  const bulkEligibleCount = bulkEligibleRows.length;
  const bulkApprovableCount = bulkEligibleRows.filter(
    (r) => r.sourceUrl != null && r.sourceUrl.length > 0,
  ).length;
  const bulkBlockedCount = bulkEligibleCount - bulkApprovableCount;

  // Visibility summary — surfaced so admins importing rows immediately see
  // why their new DRAFT rows are not visible to non-admins yet. Computed
  // from the same `rows` listing the page already loaded; no extra query.
  const visibility = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      acc[r.verificationStatus] = (acc[r.verificationStatus] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      VERIFIED: 0,
      DRAFT: 0,
      PENDING_REVIEW: 0,
      RETIRED: 0,
    } as Record<string, number>,
  );

  return (
    <>
      <Topbar
        title="Admin · Shooters World / CIP"
        actions={<Badge tone="accent">Operator</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            { label: 'Admin · Shooters World / CIP' },
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
              Reference data center, not a load engine.
            </strong>{' '}
            {CIP_SAFETY_BOUNDARY_MESSAGE}
          </p>
          <p className="text-[12px] text-text-muted">
            <code className="text-accent">
              pressurePredictionStatus: &quot;
              {CIP_PRESSURE_PREDICTION_STATUS}&quot;
            </code>
            . See the{' '}
            <Link
              href="/safety"
              className="text-accent hover:text-accent-hover"
            >
              safety policy
            </Link>{' '}
            and the README section on this feature.
          </p>
        </div>

        <Card data-testid="cip-visibility-card">
          <CardHeader
            title="Where these rows are visible"
            description="Imported rows always land as DRAFT — non-admins do not see them on /cip-reference by default. Promote rows to VERIFIED individually after comparing against the cited source."
            actions={
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/cip-reference"
                  className="text-[12px] text-accent hover:text-accent-hover"
                  data-testid="cip-public-view-link"
                >
                  Open public view (verified only) →
                </Link>
                <Link
                  href="/cip-reference?includeNeedsReview=1"
                  className="text-[12px] text-accent hover:text-accent-hover"
                  data-testid="cip-public-view-include-link"
                >
                  Open public view (include needs review) →
                </Link>
              </div>
            }
          />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[12px]">
              <div>
                <div className="text-text-faint">Total rows</div>
                <div className="text-text font-medium text-[14px]">
                  {visibility.total}
                </div>
              </div>
              <div data-testid="cip-visibility-verified">
                <div className="text-text-faint">
                  <Badge tone="success">verified</Badge>
                </div>
                <div className="text-text font-medium text-[14px]">
                  {visibility.VERIFIED}
                </div>
                <div className="text-text-faint text-[11px]">
                  Visible to all users.
                </div>
              </div>
              <div data-testid="cip-visibility-draft">
                <div className="text-text-faint">
                  <Badge tone="accent">draft</Badge>
                </div>
                <div className="text-text font-medium text-[14px]">
                  {visibility.DRAFT}
                </div>
                <div className="text-text-faint text-[11px]">
                  Hidden by default; opt-in toggle on /cip-reference.
                </div>
              </div>
              <div data-testid="cip-visibility-pending">
                <div className="text-text-faint">
                  <Badge tone="warning">pending review</Badge>
                </div>
                <div className="text-text font-medium text-[14px]">
                  {visibility.PENDING_REVIEW}
                </div>
                <div className="text-text-faint text-[11px]">
                  Hidden by default; opt-in toggle on /cip-reference.
                </div>
              </div>
              <div data-testid="cip-visibility-retired">
                <div className="text-text-faint">
                  <Badge tone="neutral">retired</Badge>
                </div>
                <div className="text-text font-medium text-[14px]">
                  {visibility.RETIRED}
                </div>
                <div className="text-text-faint text-[11px]">
                  Never shown on /cip-reference.
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card data-testid="cip-adapter-card">
          <CardHeader
            title="Adapter registry entry"
            description="Code-only registry. The Shooters World / CIP adapter is a label for the verified-reference workflow — it returns disabled status and never computes pressure."
            actions={
              <Link
                href="/admin/model-validation"
                className="text-[12px] text-accent hover:text-accent-hover"
              >
                Model validation →
              </Link>
            }
          />
          <CardBody>
            {swAdapter ? (
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
                  <tr className="border-t border-border align-top">
                    <td className="py-1.5 pr-3">
                      <code>{swAdapter.name}</code>
                    </td>
                    <td className="py-1.5 pr-3 text-text-muted">
                      {swAdapter.version}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Badge tone="danger">{swAdapter.governanceStatus}</Badge>
                    </td>
                    <td className="py-1.5 pr-3 text-text-muted">
                      {swAdapter.blockedOutputsPolicy}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] text-text-muted">
                Adapter not registered. Run the build and reload.
              </p>
            )}
          </CardBody>
        </Card>

        <Card data-testid="cip-create-card">
          <CardHeader
            title="Add reference row"
            description="Transcribe a single row from a published CIP / Shooters World source. New rows are saved as DRAFT — they are never auto-verified. Use the verify action below after comparing against the source."
            actions={
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin/shooters-world-cip/import"
                  className="text-[12px] text-accent hover:text-accent-hover"
                  data-testid="cip-assisted-import-link"
                >
                  Assisted import from URL →
                </Link>
                <Link
                  href="/admin/shooters-world-cip/bulk-import"
                  className="text-[12px] text-accent hover:text-accent-hover"
                  data-testid="cip-bulk-import-link"
                >
                  Bulk CSV import →
                </Link>
              </div>
            }
          />
          <CardBody>
            <form
              method="post"
              action="/api/admin/cip-reference/records"
              className="space-y-3"
              data-testid="cip-create-form"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Cartridge name *</span>
                  <input
                    type="text"
                    name="cartridgeName"
                    required
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Caliber label</span>
                  <input
                    type="text"
                    name="cartridgeCaliberLabel"
                    placeholder="e.g. 6.5x48"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Powder manufacturer</span>
                  <input
                    type="text"
                    name="powderManufacturer"
                    placeholder="Shooters World / Explosia"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Powder family</span>
                  <input
                    type="text"
                    name="powderFamily"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Powder name</span>
                  <input
                    type="text"
                    name="powderName"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Source URL (cip-bob.org)</span>
                  <input
                    type="text"
                    inputMode="url"
                    name="sourceUrl"
                    placeholder="https://www.cip-bobp.org/…"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Source label</span>
                  <input
                    type="text"
                    name="sourceLabel"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Source revision</span>
                  <input
                    type="text"
                    name="sourceRevision"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Source date</span>
                  <input
                    type="date"
                    name="sourceDate"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Pmax value</span>
                  <input
                    type="number"
                    name="pmaxValue"
                    step="any"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Pmax unit</span>
                  <select
                    name="pmaxUnit"
                    defaultValue=""
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  >
                    <option value="">—</option>
                    {CIP_PRESSURE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Reference chamber volume</span>
                  <input
                    type="number"
                    name="referenceChamberVolume"
                    step="any"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Reference combustion volume</span>
                  <input
                    type="number"
                    name="referenceCombustionVolume"
                    step="any"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Volume unit</span>
                  <select
                    name="volumeUnit"
                    defaultValue=""
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  >
                    <option value="">—</option>
                    {CIP_VOLUME_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Rifling F</span>
                  <input
                    type="number"
                    name="riflingF"
                    step="any"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Rifling Z</span>
                  <input
                    type="number"
                    name="riflingZ"
                    step="any"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Rifling G</span>
                  <input
                    type="number"
                    name="riflingG"
                    step="any"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Notes</span>
                <textarea
                  name="notes"
                  rows={2}
                  className="px-2 py-1 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="h-8 px-3 rounded bg-accent text-bg text-[12px] font-medium hover:bg-accent-hover"
                  data-testid="cip-create-submit"
                >
                  Save draft row
                </button>
              </div>
            </form>
            <p className="text-[11px] text-text-faint mt-2">
              No bulk import / scraping. Paste-import guidance and a CSV
              template are available at{' '}
              <Link
                href="/api/admin/cip-reference/template"
                className="text-accent hover:text-accent-hover"
              >
                /api/admin/cip-reference/template
              </Link>
              . Imported rows still land as DRAFT.
            </p>
          </CardBody>
        </Card>

        <Card data-testid="cip-list-card">
          <CardHeader
            title={`Reference rows (${rows.length})`}
            description="All rows in this workspace, regardless of verification state. Promote a row only after comparing it against the cited source."
            actions={
              <Link
                href="/cip-reference"
                className="text-[12px] text-accent hover:text-accent-hover"
              >
                User view →
              </Link>
            }
          />
          <CardBody>
            <form
              method="get"
              className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"
            >
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Cartridge filter</span>
                <input
                  type="text"
                  name="cartridge"
                  defaultValue={sp.cartridge ?? ''}
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Status</span>
                <select
                  name="status"
                  defaultValue={sp.status ?? ''}
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                >
                  <option value="">— All —</option>
                  {CIP_VERIFICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  className="h-8 px-3 rounded bg-accent text-bg text-[12px] font-medium hover:bg-accent-hover"
                >
                  Apply filter
                </button>
              </div>
            </form>

            {rows.length === 0 ? (
              <p
                className="text-[13px] text-text-muted"
                data-testid="cip-admin-empty"
              >
                No reference rows yet. Use the form above to add one.
              </p>
            ) : (
              <div
                className="overflow-x-auto space-y-3"
                data-testid="cip-bulk-verify-region"
              >
                {/* Bulk verify control bar. The actual <form> sits OUTSIDE
                    the table (HTML disallows nested forms; each row already
                    contains a Retire / Edit / Verify form). We give it an
                    id and the per-row checkboxes use the HTML5 `form`
                    attribute to associate themselves with this form. */}
                {bulkEligibleCount > 0 && <CipBulkVerifyControls />}
                {bulkEligibleCount > 0 && (
                  <form
                    id="cip-bulk-verify-form"
                    method="post"
                    action="/api/admin/cip-reference/bulk-verify"
                    className="rounded-md border border-border bg-bg-alt px-3 py-3 space-y-2"
                    data-testid="cip-bulk-verify-form"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-[12px]">
                      <span
                        className="text-text"
                        data-testid="cip-bulk-verify-selected-count"
                      >
                        <span className="font-medium">Selected:</span>{' '}
                        <span data-bulk-selected-count>0</span> of{' '}
                        {bulkEligibleCount} eligible (DRAFT /
                        PENDING_REVIEW). RETIRED and already-VERIFIED rows
                        cannot be bulk-approved.
                      </span>
                      <label className="flex items-center gap-1 text-text-muted">
                        <input
                          type="checkbox"
                          data-bulk-select-all
                          data-testid="cip-bulk-select-all"
                        />
                        <span>Select all visible eligible</span>
                      </label>
                    </div>
                    {bulkBlockedCount > 0 && (
                      <p
                        className="text-[11px] text-text-faint"
                        data-testid="cip-bulk-verify-blocked-hint"
                      >
                        {bulkBlockedCount} eligible row(s) are still missing a
                        source URL. You may still tick them — the API will
                        skip them with a per-row reason instead of failing
                        the whole batch.
                      </p>
                    )}
                    <label className="flex items-start gap-2 text-[12px] text-text-muted">
                      <input
                        type="checkbox"
                        name="acknowledgedVerifiedAgainstSource"
                        required
                        data-testid="cip-bulk-verify-ack"
                      />
                      <span>
                        I have compared each selected row against the
                        published CIP and/or Shooters World public source and
                        confirm the transcribed values match. I understand
                        these rows are reference metadata only — the app
                        does not compute pressure, recommend charges, advise
                        increases or decreases, or issue safe / unsafe
                        verdicts.
                      </span>
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="h-7 px-3 rounded bg-success text-bg text-[12px] font-medium hover:opacity-90"
                        data-testid="cip-bulk-verify-submit"
                      >
                        Bulk verify selected
                      </button>
                    </div>
                  </form>
                )}
                <table className="w-full text-[12px]">
                  <thead className="text-left text-text-faint">
                    <tr>
                      <th className="py-1 pr-2 font-medium w-6">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="py-1 pr-3 font-medium">Cartridge</th>
                      <th className="py-1 pr-3 font-medium">Powder</th>
                      <th className="py-1 pr-3 font-medium">Pmax</th>
                      <th className="py-1 pr-3 font-medium">Vols</th>
                      <th className="py-1 pr-3 font-medium">F · Z · G</th>
                      <th className="py-1 pr-3 font-medium">Source</th>
                      <th className="py-1 pr-3 font-medium">Status</th>
                      <th className="py-1 pr-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {rows.map((r) => {
                      const bulkEligible =
                        r.verificationStatus === 'DRAFT' ||
                        r.verificationStatus === 'PENDING_REVIEW';
                      const bulkMissingSourceUrl =
                        bulkEligible &&
                        (r.sourceUrl == null || r.sourceUrl.length === 0);
                      return (
                      <React.Fragment key={r.id}>
                      <tr
                        className="border-t border-border align-top"
                        data-testid={`cip-admin-row-${r.id}`}
                      >
                        <td className="py-1.5 pr-2 align-top">
                          {bulkEligible ? (
                            <input
                              type="checkbox"
                              name="recordId"
                              value={r.id}
                              form="cip-bulk-verify-form"
                              data-bulk-select-row
                              data-testid={`cip-bulk-select-${r.id}`}
                              aria-label={`Select ${r.cartridgeName} for bulk verify`}
                            />
                          ) : (
                            <span
                              className="inline-block w-3 h-3"
                              aria-hidden
                            />
                          )}
                          {bulkMissingSourceUrl && (
                            <div
                              className="text-[10px] text-text-faint mt-1"
                              data-testid={`cip-bulk-missing-sourceurl-${r.id}`}
                            >
                              no URL
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-3">
                          <div className="font-medium">{r.cartridgeName}</div>
                          {r.cartridgeCaliberLabel && (
                            <div className="text-text-faint text-[11px]">
                              {r.cartridgeCaliberLabel}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-3">
                          {r.powderManufacturer && (
                            <div className="text-text-muted">
                              {r.powderManufacturer}
                            </div>
                          )}
                          {r.powderName && <div>{r.powderName}</div>}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {formatPmax(r.pmaxValue, r.pmaxUnit)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-text-muted">
                          <div>
                            ch:{' '}
                            {formatVolume(
                              r.referenceChamberVolume,
                              r.volumeUnit,
                            )}
                          </div>
                          <div>
                            co:{' '}
                            {formatVolume(
                              r.referenceCombustionVolume,
                              r.volumeUnit,
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-text-muted">
                          {[r.riflingF, r.riflingZ, r.riflingG]
                            .map((v) => (v == null ? '—' : String(v)))
                            .join(' · ')}
                        </td>
                        <td className="py-1.5 pr-3">
                          {r.sourceUrl ? (
                            <a
                              href={r.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:text-accent-hover break-all"
                            >
                              {r.sourceLabel ?? r.sourceUrl}
                            </a>
                          ) : (
                            <span className="text-text-faint">—</span>
                          )}
                          {r.sourceDate && (
                            <div className="text-text-faint text-[11px]">
                              {r.sourceDate.toISOString().slice(0, 10)}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-3">
                          <Badge tone={statusBadgeTone(r.verificationStatus)}>
                            {r.verificationStatus.toLowerCase()}
                          </Badge>
                          {r.verifiedByEmail && (
                            <div className="text-text-faint text-[11px] mt-1">
                              by {r.verifiedByEmail}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 space-y-1">
                          <span className="text-[11px] text-text-faint">
                            Use the editor below the row to edit fields or verify.
                          </span>
                          {r.verificationStatus !== 'RETIRED' && (
                            <form
                              method="post"
                              action="/api/admin/cip-reference/retire"
                            >
                              <input
                                type="hidden"
                                name="recordId"
                                value={r.id}
                              />
                              <button
                                type="submit"
                                className="h-6 px-2 rounded bg-bg-alt border border-border text-[11px] text-text-muted hover:text-text"
                              >
                                Retire
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                      <tr
                        className="border-t-0 align-top"
                        data-testid={`cip-admin-row-editor-${r.id}`}
                      >
                        <td colSpan={9} className="py-0 pr-3">
                          <CipRowEditor record={r} />
                        </td>
                      </tr>
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card data-testid="cip-csv-card">
          <CardHeader
            title="CSV template & bulk import"
            description="Operators may transcribe rows in batches via CSV. Each imported row lands as DRAFT — no row is auto-verified. There is no scraping of cip-bob.org."
            actions={
              <Link
                href="/admin/shooters-world-cip/bulk-import"
                className="text-[12px] text-accent hover:text-accent-hover"
                data-testid="cip-bulk-import-card-link"
              >
                Open bulk CSV import →
              </Link>
            }
          />
          <CardBody>
            <ul className="text-[13px] text-text-muted list-disc pl-5 space-y-1">
              <li>
                Download the headers-only CSV template at{' '}
                <Link
                  href="/api/admin/cip-reference/template"
                  className="text-accent hover:text-accent-hover"
                >
                  /api/admin/cip-reference/template
                </Link>
                .
              </li>
              <li>
                The template includes one synthetic example row labelled{' '}
                <code className="text-accent">PLACEHOLDER</code>. Delete it
                before importing your own.
              </li>
              <li>
                Use{' '}
                <Link
                  href="/admin/shooters-world-cip/bulk-import"
                  className="text-accent hover:text-accent-hover"
                >
                  /admin/shooters-world-cip/bulk-import
                </Link>{' '}
                to upload or paste the completed CSV. The page validates each
                row, previews errors and warnings, and requires an admin
                acknowledgement before saving. Imported rows always land as
                DRAFT — verify them individually after comparing against the
                cited source.
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
