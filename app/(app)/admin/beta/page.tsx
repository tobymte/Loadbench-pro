import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getAdminContext } from '@/lib/auth/admin';
import { collectChecks, summarize } from '@/lib/deployment/check';

// /admin/beta
//
// Operator dashboard for the beta release. Aggregates the deployment-check
// summary, the release checklist, and links to the tester-facing beta page.

export const dynamic = 'force-dynamic';

export default async function AdminBetaPage() {
  const admin = await getAdminContext();

  if (!admin.isAdmin) {
    return (
      <>
        <Topbar
          title="Beta release · operator"
          actions={<Badge tone="danger">Operator-only</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          <Card>
            <CardHeader
              title="Operator-only"
              description="The beta release dashboard is restricted to operators."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted">
                {admin.reason ?? 'You are not authorized to view this page.'}
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const groups = collectChecks();
  const summary = summarize(groups);
  const blockers = summary.missing;
  const warnings = summary.warn;

  return (
    <>
      <Topbar
        title="Beta release · operator"
        actions={
          blockers === 0 ? (
            <Badge tone="success">Ready</Badge>
          ) : (
            <Badge tone="danger">{blockers} blocker{blockers === 1 ? '' : 's'}</Badge>
          )
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Release readiness"
            description="Quick snapshot of deployment configuration. Investigate any 'missing' entries before opening the beta to new testers."
            actions={
              <Link href="/admin/deployment-check">
                <Button size="sm" variant="secondary">
                  Full diagnostics →
                </Button>
              </Link>
            }
          />
          <CardBody className="flex flex-wrap items-center gap-3">
            <Badge tone="success">{summary.ok} ok</Badge>
            {warnings > 0 && <Badge tone="warning">{warnings} warn</Badge>}
            {blockers > 0 && <Badge tone="danger">{blockers} missing</Badge>}
            <Badge tone="neutral">{summary.info} info</Badge>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Tester-facing beta package"
            description="The page testers see. Walks them through the safety disclaimer, known limitations, test scenarios, and the bug-report template."
            actions={
              <Link href="/beta">
                <Button size="sm">Open tester page</Button>
              </Link>
            }
          />
          <CardBody>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Share <code className="text-accent">/beta</code> with new testers
              along with their sign-up email. They will be prompted through
              <code className="text-accent"> /onboarding</code> automatically on
              first login.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Beta issue tracker"
            description="Triage user-submitted feedback and issues. Filter by status, type, and severity; expand any row to update status and admin notes."
            actions={
              <Link href="/admin/beta/issues">
                <Button size="sm">Open issue tracker →</Button>
              </Link>
            }
          />
          <CardBody>
            <p className="text-[12px] text-text-muted leading-relaxed">
              The tester-facing form lives at{' '}
              <code className="text-accent">/beta/feedback</code>. Counts by
              status and full filters are on the tracker page.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Operator quick-links"
            description="Pages you need most during a beta cycle."
          />
          <CardBody className="flex flex-wrap gap-2">
            <Link href="/admin/beta/issues">
              <Button variant="secondary">Beta issue tracker</Button>
            </Link>
            <Link href="/admin/deployment-check">
              <Button variant="secondary">Deployment check</Button>
            </Link>
            <Link href="/admin/entitlements">
              <Button variant="secondary">Entitlements</Button>
            </Link>
            <Link href="/admin/model-validation">
              <Button variant="secondary">Model validation</Button>
            </Link>
            <Link href="/admin/model-validation/templates">
              <Button variant="secondary">Validation templates</Button>
            </Link>
            <Link href="/data-tools">
              <Button variant="secondary">Workspace export</Button>
            </Link>
            <Link href="/settings/deployment">
              <Button variant="secondary">Deployment guide</Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Safety guardrail summary"
            description="Confirm — every cycle — that nothing has been added that crosses the safety boundary."
          />
          <CardBody>
            <ul className="list-disc pl-5 text-[12px] text-text-muted space-y-1 leading-relaxed">
              <li>Pressure prediction is hardcoded disabled.</li>
              <li>No PSI / chamber pressure is exposed to non-admin users.</li>
              <li>No charge recommendations, no powder substitutions, no safe/unsafe verdicts anywhere in the app.</li>
              <li>External ballistics covers only downrange flight (trajectory, drop, drift, time of flight, velocity, energy).</li>
              <li>Load validation refuses any charge above the cited published maximum.</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
