import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BetaFeedbackForm } from '@/components/forms/BetaFeedbackForm';
import { isDatabaseConfigured, safeWithWorkspace } from '@/lib/db/safeLoad';
import {
  feedbackStatusLabel,
  feedbackStatusTone,
  feedbackTypeLabel,
  feedbackSeverityLabel,
} from '@/lib/beta/feedback';

// /beta/feedback
//
// User-facing beta feedback submission. Below the form, shows the most
// recent submissions from the current workspace so the tester can see their
// reports were received and what their status is.

export const dynamic = 'force-dynamic';

type RecentRow = {
  id: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  pageArea: string | null;
  createdAt: Date;
};

export default async function BetaFeedbackPage() {
  const dbConfigured = isDatabaseConfigured();

  let recent: RecentRow[] = [];
  let authenticated = false;
  let unavailableReason:
    | 'no-database'
    | 'unauthenticated'
    | 'lookup-failed'
    | null = null;

  if (dbConfigured) {
    const result = await safeWithWorkspace(async ({ prisma, workspaceId }) => {
      const rows = await prisma.betaFeedbackIssue.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          type: true,
          severity: true,
          status: true,
          pageArea: true,
          createdAt: true,
        },
      });
      return rows;
    });
    if (result.ok) {
      authenticated = true;
      recent = result.data;
    } else {
      unavailableReason = result.reason;
    }
  } else {
    unavailableReason = 'no-database';
  }

  return (
    <>
      <Topbar
        title="Beta feedback"
        actions={<Badge tone="accent">Beta</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Help us shape the beta"
            description="One report per issue is fine — we'd rather have many short reports than one combined one. The admin issue tracker triages, statuses, and resolves these."
            actions={
              <Link href="/beta">
                <Button size="sm" variant="secondary">
                  Back to beta package
                </Button>
              </Link>
            }
          />
          <CardBody>
            <ul className="list-disc pl-5 text-[12px] text-text-muted leading-relaxed space-y-1">
              <li>
                For known limitations and the test scenarios, see{' '}
                <Link href="/beta" className="text-accent">
                  /beta
                </Link>
                .
              </li>
              <li>
                For the full safety policy, see{' '}
                <Link href="/safety" className="text-accent">
                  /safety
                </Link>
                .
              </li>
              <li>
                Safety concerns are accepted as user reports only — the app
                does not turn them into pressure estimates, charge advice, or
                safe/unsafe verdicts.
              </li>
            </ul>
          </CardBody>
        </Card>

        {unavailableReason === 'no-database' && (
          <Card className="border-warning/40">
            <CardHeader
              title="Setup required"
              description="Feedback storage is not configured."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted leading-relaxed">
                <code className="text-accent">DATABASE_URL</code> is not set,
                so submissions cannot be stored yet. Ask your operator to
                finish deployment setup. The form below will display the same
                notice when you try to submit.
              </p>
            </CardBody>
          </Card>
        )}

        {unavailableReason === 'lookup-failed' && (
          <Card className="border-warning/40">
            <CardHeader
              title="Database reachable but lookup failed"
              description="Your workspace lookup did not succeed."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted leading-relaxed">
                The migration may not have been applied. You can still try to
                submit; an admin will see the row even if your workspace
                association is missing.
              </p>
            </CardBody>
          </Card>
        )}

        <BetaFeedbackForm authenticated={authenticated} />

        <Card>
          <CardHeader
            title="My recent feedback"
            description={
              authenticated
                ? 'Up to the most recent ten reports from your workspace.'
                : 'Sign in to see your reports here. Until then, reports are still recorded.'
            }
          />
          <CardBody className="!p-0">
            {recent.length === 0 ? (
              <div className="px-5 py-4 text-[12px] text-text-muted">
                {authenticated
                  ? 'No reports yet from this workspace.'
                  : unavailableReason === 'unauthenticated'
                    ? 'Sign in to view your reports.'
                    : 'No reports yet.'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((r) => (
                  <li
                    key={r.id}
                    className="px-5 py-3 flex flex-wrap items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">
                        {r.title}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {feedbackTypeLabel(r.type)} ·{' '}
                        {feedbackSeverityLabel(r.severity)}
                        {r.pageArea ? ` · ${r.pageArea}` : ''} ·{' '}
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge tone={feedbackStatusTone(r.status)}>
                      {feedbackStatusLabel(r.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
