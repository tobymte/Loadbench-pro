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
  CIP_TEMPLATE_HEADERS,
} from '@/lib/validation/cipReference';
import { BulkImportForm } from './BulkImportForm';

export const dynamic = 'force-dynamic';

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
        title="Admin · CIP Bulk CSV Import"
        actions={<Badge tone="danger">Unauthorized</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
        <Card data-testid="cip-bulk-unauthorized">
          <CardHeader
            title="Admin access required"
            description="CIP bulk import is admin-only. Pressure prediction remains disabled regardless of access state."
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
        title="Admin · CIP Bulk CSV Import"
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

export default async function CipBulkImportPage() {
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
        title="Admin · CIP Bulk CSV Import"
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
            { label: 'Bulk CSV Import' },
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

        <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-1">
          <p>
            <strong className="font-semibold">
              Reference metadata batch entry, not a load engine.
            </strong>{' '}
            {CIP_SAFETY_BOUNDARY_MESSAGE}
          </p>
          <p className="text-[12px] text-text-muted">
            <code className="text-accent">
              pressurePredictionStatus: &quot;{CIP_PRESSURE_PREDICTION_STATUS}
              &quot;
            </code>
            . Bulk import creates DRAFT rows from a CSV you transcribed; it
            never auto-verifies, never computes pressure, and never recommends
            charges. See the{' '}
            <Link
              href="/safety"
              className="text-accent hover:text-accent-hover"
            >
              safety policy
            </Link>
            .
          </p>
        </div>

        <Card data-testid="cip-bulk-form-card">
          <CardHeader
            title="Upload or paste CSV"
            description="Validates each row, previews it with errors and warnings, and — after explicit admin acknowledgement — saves all valid rows as DRAFT."
            actions={<Badge tone="accent">Step 1 of 2</Badge>}
          />
          <CardBody>
            <BulkImportForm />
          </CardBody>
        </Card>

        <Card data-testid="cip-bulk-headers-card">
          <CardHeader
            title="Accepted CSV headers"
            description="Match the canonical names below (case-insensitive; spaces / underscores ignored). Friendly aliases like CARTRIDGE, POWDER, MFR, URL, PRESSURE UNIT are accepted."
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-left text-text-faint">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Header</th>
                    <th className="py-1 pr-3 font-medium">Required?</th>
                    <th className="py-1 pr-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-text">
                  {CIP_TEMPLATE_HEADERS.map((h) => (
                    <tr key={h} className="border-t border-border align-top">
                      <td className="py-1.5 pr-3 font-mono">{h}</td>
                      <td className="py-1.5 pr-3">
                        {h === 'cartridgeName' ? (
                          <span className="text-danger">required</span>
                        ) : (
                          <span className="text-text-muted">optional</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-text-muted">
                        {h === 'sourceUrl' &&
                          'http(s) URL. Non-CIP hosts → warning. Required for VERIFIED later.'}
                        {h === 'pmaxUnit' && 'One of BAR, MPA, PSI.'}
                        {h === 'volumeUnit' && 'One of CM3, ML, GRAIN_H2O.'}
                        {h === 'sourceDate' && 'YYYY-MM-DD (or any parseable date).'}
                        {(h === 'pmaxValue' ||
                          h === 'referenceChamberVolume' ||
                          h === 'referenceCombustionVolume' ||
                          h === 'riflingF' ||
                          h === 'riflingZ' ||
                          h === 'riflingG') &&
                          'Numeric. Reference metadata only — never converted to a per-handload prediction.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-text-faint mt-3">
              Get a starter file with these headers and one placeholder row at{' '}
              <Link
                href="/api/admin/cip-reference/template"
                className="text-accent hover:text-accent-hover"
              >
                /api/admin/cip-reference/template
              </Link>
              . Delete the placeholder before importing.
            </p>
          </CardBody>
        </Card>

        <Card data-testid="cip-bulk-guardrails-card">
          <CardHeader
            title="Guardrails"
            description="What this importer will refuse to do."
          />
          <CardBody>
            <ul className="text-[13px] text-text-muted list-disc pl-5 space-y-1">
              <li>No pressure prediction, no charge recommendation, no safe / unsafe verdict, no powder substitution advice.</li>
              <li>
                Forbidden output keys (e.g.{' '}
                <code className="text-accent">predictedPressurePsi</code>,{' '}
                <code className="text-accent">recommendedCharge</code>) in the
                CSV body cause the entire upload to be rejected.
              </li>
              <li>Imported rows are always <Badge tone="accent">draft</Badge>. Verification is a separate, per-row admin action.</li>
              <li>Row-level errors block the import; warnings (non-CIP host, missing source, missing units) are surfaced but do not block.</li>
              <li>Hard limits: 1 MB CSV body, 500 rows per import.</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
