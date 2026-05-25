import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  CIP_PRESSURE_PREDICTION_STATUS,
  CIP_SAFETY_BOUNDARY_MESSAGE,
} from '@/lib/validation/cipReference';
import { CIP_KNOWN_HOSTS } from '@/lib/validation/cipSourceFetch';
import { AssistedImportForm } from './AssistedImportForm';

export const dynamic = 'force-dynamic';

type SearchParams = {
  ok?: string;
  error?: string;
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
        title="Admin · Assisted CIP Source Import"
        actions={<Badge tone="danger">Unauthorized</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
        <Card data-testid="cip-import-unauthorized">
          <CardHeader
            title="Admin access required"
            description="Assisted CIP Source Import is admin-only. Pressure prediction remains disabled regardless of access state."
          />
          <CardBody>
            <p className="text-[13px] text-text-muted">
              {reason ?? 'You are not authorized to view this page.'}
            </p>
            <p className="text-[12px] text-text-faint mt-3">
              Set <code className="text-accent">LOADBENCH_ADMIN_EMAILS</code>{' '}
              or, for local dev,{' '}
              <code className="text-accent">LOADBENCH_DISABLE_AUTH=true</code>.
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
        title="Admin · Assisted CIP Source Import"
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

export default async function AssistedCipImportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return <UnauthorizedView reason={admin.reason} />;
  }

  try {
    await getWorkspaceContext();
  } catch (e) {
    return <NotConfiguredView message={describeError(e)} />;
  }

  return (
    <>
      <Topbar
        title="Admin · Assisted CIP Source Import"
        actions={<Badge tone="accent">Operator</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            {
              href: '/admin/shooters-world-cip',
              label: 'Admin · Shooters World / CIP',
            },
            { label: 'Assisted Import' },
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
              Source metadata assistant, not a load engine.
            </strong>{' '}
            {CIP_SAFETY_BOUNDARY_MESSAGE}
          </p>
          <p className="text-[12px] text-text-muted">
            <code className="text-accent">
              pressurePredictionStatus: &quot;{CIP_PRESSURE_PREDICTION_STATUS}
              &quot;
            </code>
            . This page can detect a source URL and create a DRAFT row. It
            does <strong>not</strong> parse PDFs, extract pressure values,
            recommend charges, or auto-verify any record. See the{' '}
            <Link
              href="/safety"
              className="text-accent hover:text-accent-hover"
            >
              safety policy
            </Link>
            .
          </p>
        </div>

        <Card data-testid="cip-import-card">
          <CardHeader
            title="Paste a CIP source URL"
            description="Detects basic source metadata (URL, host, content type, HTML title or PDF filename, last-modified) and creates a DRAFT CIP reference row seeded with the URL. Numeric reference fields (Pmax, volumes, rifling) are left blank for manual transcription."
            actions={<Badge tone="accent">Step 1</Badge>}
          />
          <CardBody>
            <AssistedImportForm />
          </CardBody>
        </Card>

        <Card data-testid="cip-import-workflow-card">
          <CardHeader
            title="Workflow"
            description="How an assisted import becomes a verified row."
          />
          <CardBody>
            <ol className="text-[13px] text-text-muted list-decimal pl-5 space-y-1">
              <li>
                Paste the official CIP TDCC / source URL above. Allow-list:{' '}
                {CIP_KNOWN_HOSTS.join(', ')}.
              </li>
              <li>
                Click <strong>Fetch source metadata</strong> to preview what
                the server sees (HTTP status, content type, title or PDF
                filename, last-modified). No PDF body is parsed.
              </li>
              <li>
                Fill in cartridge name and any powder fields you can read off
                the source. Submit to create a DRAFT row.
              </li>
              <li>
                Open the{' '}
                <Link
                  href="/admin/shooters-world-cip"
                  className="text-accent hover:text-accent-hover"
                >
                  main admin page
                </Link>
                . Edit the draft to transcribe Pmax, reference chamber /
                combustion volumes, and rifling F·Z·G from the cited source.
              </li>
              <li>
                Tick the &quot;I have compared this row against the cited
                source&quot; acknowledgement and click <strong>Verify</strong>
                . Verification requires a source URL on the row.
              </li>
            </ol>
          </CardBody>
        </Card>

        <Card data-testid="cip-import-guardrails-card">
          <CardHeader
            title="Guardrails"
            description="What this importer will refuse to do."
          />
          <CardBody>
            <ul className="text-[13px] text-text-muted list-disc pl-5 space-y-1">
              <li>No PDF body parsing — Pmax values are never auto-filled.</li>
              <li>
                No pressure prediction, no charge recommendation, no
                safe/unsafe verdict, no powder substitution advice.
              </li>
              <li>
                Forbidden output keys (e.g.{' '}
                <code className="text-accent">predictedPressurePsi</code>,{' '}
                <code className="text-accent">recommendedCharge</code>) are
                rejected at both the preview and create endpoints.
              </li>
              <li>
                Non-CIP hosts are warned and require an explicit
                acknowledgement before a draft can be created from them.
              </li>
              <li>
                Newly created rows are always{' '}
                <Badge tone="accent">draft</Badge>. Verification is a
                separate, deliberate step.
              </li>
              <li>
                Verification refuses any row that has no source URL — even if
                an admin clicks the button.
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
