import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getAdminContext } from '@/lib/auth/admin';
import { isDatabaseConfigured } from '@/lib/db/safeLoad';
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  FEEDBACK_SEVERITIES,
  feedbackStatusLabel,
} from '@/lib/beta/feedback';
import { BetaFeedbackAdminRow } from '@/components/forms/BetaFeedbackAdminRow';

// /admin/beta/issues
//
// Admin issue tracker for beta feedback submissions. Filters by status,
// type, and severity. Expandable rows let the operator update status and
// add admin notes inline.

export const dynamic = 'force-dynamic';

const STATUS_FILTER_VALUES = FEEDBACK_STATUSES.map((s) => s.value);
const TYPE_FILTER_VALUES = FEEDBACK_TYPES.map((t) => t.value);
const SEVERITY_FILTER_VALUES = FEEDBACK_SEVERITIES.map((s) => s.value);

type SearchParams = {
  status?: string | string[];
  type?: string | string[];
  severity?: string | string[];
};

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function AdminBetaIssuesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return (
      <>
        <Topbar
          title="Beta · issue tracker"
          actions={<Badge tone="danger">Operator-only</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          <Card>
            <CardHeader
              title="Operator-only"
              description="The beta issue tracker is restricted to operators."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted">
                {admin.reason ?? 'You are not authorized to view this page.'}
              </p>
              <div className="mt-3">
                <Link href="/beta/feedback">
                  <Button size="sm" variant="secondary">
                    Submit feedback instead →
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const sp = await searchParams;
  const statusFilter = pickFirst(sp.status);
  const typeFilter = pickFirst(sp.type);
  const severityFilter = pickFirst(sp.severity);

  if (!isDatabaseConfigured()) {
    return (
      <>
        <Topbar title="Beta · issue tracker" />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          <Card className="border-warning/40">
            <CardHeader
              title="Setup required"
              description="No database configured."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted">
                Set <code className="text-accent">DATABASE_URL</code> and run{' '}
                <code className="text-accent">npx prisma migrate deploy</code>{' '}
                to enable the issue tracker.
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  let rows:
    | Array<{
        id: string;
        title: string;
        type: string;
        severity: string;
        status: string;
        pageArea: string | null;
        description: string;
        stepsToReproduce: string | null;
        expectedResult: string | null;
        actualResult: string | null;
        deviceBrowser: string | null;
        contactPreference: string | null;
        reporterEmail: string | null;
        reporterDisplay: string | null;
        workspaceId: string | null;
        buildHash: string | null;
        adminNotes: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    | null = null;
  let counts: Record<string, number> = {};
  let loadError: string | null = null;

  try {
    const { prisma } = await import('@/lib/db/prisma');

    const where: Record<string, unknown> = {};
    if (statusFilter && STATUS_FILTER_VALUES.includes(statusFilter as never)) {
      where.status = statusFilter;
    }
    if (typeFilter && TYPE_FILTER_VALUES.includes(typeFilter as never)) {
      where.type = typeFilter;
    }
    if (
      severityFilter &&
      SEVERITY_FILTER_VALUES.includes(severityFilter as never)
    ) {
      where.severity = severityFilter;
    }

    rows = await prisma.betaFeedbackIssue.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });

    const grouped = await prisma.betaFeedbackIssue.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    counts = Object.fromEntries(
      grouped.map((g) => [g.status as string, g._count._all]),
    );
  } catch (err) {
    loadError =
      err instanceof Error ? err.message.slice(0, 240) : 'unknown error';
  }

  if (loadError) {
    return (
      <>
        <Topbar title="Beta · issue tracker" />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          <Card className="border-warning/40">
            <CardHeader
              title="Database reachable but lookup failed"
              description="Migration may not be applied yet."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted leading-relaxed">
                Run{' '}
                <code className="text-accent">npx prisma migrate deploy</code>{' '}
                to apply the{' '}
                <code className="text-accent">
                  20260525120000_beta_feedback_issue
                </code>{' '}
                migration. Error: {loadError}
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const totalShowing = rows?.length ?? 0;

  return (
    <>
      <Topbar
        title="Beta · issue tracker"
        actions={
          <>
            <Badge tone="accent">{totalShowing} showing</Badge>
            <Link href="/beta/feedback">
              <Button size="sm" variant="secondary">
                Submit feedback →
              </Button>
            </Link>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Counts by status"
            description="All-time totals across all submitters and workspaces."
          />
          <CardBody className="flex flex-wrap items-center gap-2">
            {FEEDBACK_STATUSES.map((s) => (
              <Badge key={s.value} tone={s.tone}>
                {s.label}: {counts[s.value] ?? 0}
              </Badge>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Filters"
            description="Combine any of these — empty selects mean “any”."
          />
          <CardBody>
            <form
              method="GET"
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <Filter
                name="status"
                label="Status"
                value={statusFilter}
                options={FEEDBACK_STATUSES.map((s) => ({
                  value: s.value,
                  label: feedbackStatusLabel(s.value),
                }))}
              />
              <Filter
                name="type"
                label="Type"
                value={typeFilter}
                options={FEEDBACK_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
              />
              <Filter
                name="severity"
                label="Severity"
                value={severityFilter}
                options={FEEDBACK_SEVERITIES.map((s) => ({
                  value: s.value,
                  label: s.label,
                }))}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Apply
                </Button>
                <Link href="/admin/beta/issues">
                  <Button type="button" size="sm" variant="ghost">
                    Clear
                  </Button>
                </Link>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Issues"
            description="Click any row to expand the full report and update status / admin notes."
          />
          <CardBody className="!p-0">
            {!rows || rows.length === 0 ? (
              <div className="px-5 py-4 text-[12px] text-text-muted">
                No issues match the current filters.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <BetaFeedbackAdminRow
                    key={r.id}
                    row={{
                      ...r,
                      createdAt: r.createdAt.toISOString(),
                      updatedAt: r.updatedAt.toISOString(),
                    }}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Filter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[12px] font-medium text-text">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ''}
        className="w-full h-9 rounded border border-border bg-bg px-2.5 text-[13px] text-text"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
