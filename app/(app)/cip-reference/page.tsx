import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { safeWithWorkspace, describeUnavailability } from '@/lib/db/safeLoad';
import {
  listVerifiedCipRecords,
  type CipListFilters,
} from '@/lib/validation/cipReferenceDb';
import {
  formatPmax,
  formatVolume,
  statusBadgeTone,
  parseCipNotes,
  CIP_SAFETY_BOUNDARY_MESSAGE,
  CIP_PRESSURE_PREDICTION_STATUS,
} from '@/lib/validation/cipReference';

export const dynamic = 'force-dynamic';

type SearchParams = {
  cartridge?: string;
  powder?: string;
  manufacturer?: string;
  projectile?: string;
  bulletWeight?: string;
  includeNeedsReview?: string;
};

function SafetyBanner({ includeNeedsReview }: { includeNeedsReview: boolean }) {
  return (
    <div
      className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-1"
      data-testid="cip-safety-banner"
    >
      <p>
        <strong className="font-semibold">
          Reference data only — never a load recommendation.
        </strong>{' '}
        {CIP_SAFETY_BOUNDARY_MESSAGE}
      </p>
      <p className="text-[12px] text-text-muted">
        <code className="text-accent">
          pressurePredictionStatus: &quot;{CIP_PRESSURE_PREDICTION_STATUS}&quot;
        </code>
        . See the{' '}
        <Link href="/safety" className="text-accent hover:text-accent-hover">
          safety policy
        </Link>{' '}
        before using any value below.
      </p>
      {includeNeedsReview && (
        <p
          className="text-[12px] text-warning"
          data-testid="cip-include-needs-review-warning"
        >
          <strong className="font-semibold">Heads up:</strong> &ldquo;Include
          rows that still need review&rdquo; is on. Rows badged{' '}
          <Badge tone="accent">draft</Badge> or{' '}
          <Badge tone="warning">pending review</Badge> have not been confirmed
          against the cited source. Treat their values as unverified
          transcription only.
        </p>
      )}
    </div>
  );
}

function UnavailableView({ message }: { message: string }) {
  return (
    <>
      <Topbar
        title="Shooters World / CIP Reference"
        actions={<Badge tone="warning">Unavailable</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
        <SafetyBanner includeNeedsReview={false} />
        <Card data-testid="cip-reference-unavailable">
          <CardHeader
            title="Reference data is unavailable"
            description="The reference center cannot be queried right now."
          />
          <CardBody>
            <p className="text-[13px] text-text-muted">{message}</p>
            <p className="text-[12px] text-text-faint mt-3">
              Typical fixes: run{' '}
              <code className="text-accent">npx prisma migrate deploy</code>,
              then <code className="text-accent">npx prisma generate</code>,
              and confirm{' '}
              <code className="text-accent">DATABASE_URL</code> is set. The
              app remains usable for everything else — reference rows are
              purely citation metadata.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function dash(value: string | null | undefined) {
  return value && value.length > 0 ? value : '—';
}

export default async function CipReferencePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const includeNeedsReview = sp.includeNeedsReview === '1';
  const filters: CipListFilters = {
    cartridge: sp.cartridge?.trim() || null,
    powder: sp.powder?.trim() || null,
    manufacturer: sp.manufacturer?.trim() || null,
    projectile: sp.projectile?.trim() || null,
    bulletWeight: sp.bulletWeight?.trim() || null,
    includeNeedsReview,
  };

  const result = await safeWithWorkspace(({ workspaceId }) =>
    listVerifiedCipRecords(workspaceId, filters),
  );

  if (!result.ok) {
    return <UnavailableView message={describeUnavailability(result.reason)} />;
  }

  const rows = result.data;
  const verifiedCount = rows.filter(
    (r) => r.verificationStatus === 'VERIFIED',
  ).length;
  const needsReviewCount = rows.length - verifiedCount;

  // Preserve current filter state when toggling the needs-review checkbox.
  const baseQuery = new URLSearchParams();
  if (filters.cartridge) baseQuery.set('cartridge', filters.cartridge);
  if (filters.powder) baseQuery.set('powder', filters.powder);
  if (filters.manufacturer) baseQuery.set('manufacturer', filters.manufacturer);
  if (filters.projectile) baseQuery.set('projectile', filters.projectile);
  if (filters.bulletWeight) baseQuery.set('bulletWeight', filters.bulletWeight);
  const verifiedOnlyHref = `/cip-reference${
    baseQuery.toString() ? `?${baseQuery.toString()}` : ''
  }`;
  const includeQuery = new URLSearchParams(baseQuery);
  includeQuery.set('includeNeedsReview', '1');
  const includeHref = `/cip-reference?${includeQuery.toString()}`;

  return (
    <>
      <Topbar
        title="Shooters World / CIP Reference"
        actions={
          includeNeedsReview ? (
            <Badge tone="warning">Includes unverified · reference only</Badge>
          ) : (
            <Badge tone="success">Verified · reference only</Badge>
          )
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            { label: 'Shooters World / CIP Reference' },
          ]}
        />

        <SafetyBanner includeNeedsReview={includeNeedsReview} />

        <Card data-testid="cip-filters-card">
          <CardHeader
            title="Search"
            description="Filter reference rows by cartridge, powder, manufacturer, projectile, or bullet weight. By default only VERIFIED rows are shown."
          />
          <CardBody>
            <form
              method="get"
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
              data-testid="cip-filter-form"
            >
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Cartridge</span>
                <input
                  type="text"
                  name="cartridge"
                  defaultValue={filters.cartridge ?? ''}
                  placeholder="e.g. 6.5 Creedmoor"
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Powder</span>
                <input
                  type="text"
                  name="powder"
                  defaultValue={filters.powder ?? ''}
                  placeholder="e.g. Precision Rifle 4350"
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Manufacturer</span>
                <input
                  type="text"
                  name="manufacturer"
                  defaultValue={filters.manufacturer ?? ''}
                  placeholder="Shooters World / Explosia"
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Projectile</span>
                <input
                  type="text"
                  name="projectile"
                  defaultValue={filters.projectile ?? ''}
                  placeholder="e.g. ELD-M"
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  data-testid="cip-filter-projectile"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Bullet weight</span>
                <input
                  type="text"
                  name="bulletWeight"
                  defaultValue={filters.bulletWeight ?? ''}
                  placeholder="e.g. 140 gr"
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  data-testid="cip-filter-bullet-weight"
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-text-muted self-end">
                <input
                  type="checkbox"
                  name="includeNeedsReview"
                  value="1"
                  defaultChecked={includeNeedsReview}
                  className="accent-warning"
                  data-testid="cip-filter-include-needs-review"
                />
                <span>
                  Include rows that still need review (DRAFT / PENDING)
                </span>
              </label>
              <div className="md:col-span-3 flex gap-2 justify-end">
                <Link
                  href="/cip-reference"
                  className="text-[12px] text-text-muted hover:text-text self-center"
                >
                  Reset
                </Link>
                <button
                  type="submit"
                  className="h-8 px-3 rounded bg-accent text-bg text-[12px] font-medium hover:bg-accent-hover"
                  data-testid="cip-filter-submit"
                >
                  Apply
                </button>
              </div>
            </form>
            <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-text-faint">
              <span>
                Showing{' '}
                <strong className="text-text">{rows.length}</strong> rows
                {includeNeedsReview
                  ? ` (${verifiedCount} verified · ${needsReviewCount} need review)`
                  : ''}
                .
              </span>
              {includeNeedsReview ? (
                <Link
                  href={verifiedOnlyHref}
                  className="text-accent hover:text-accent-hover"
                  data-testid="cip-filter-verified-only-link"
                >
                  Show verified only →
                </Link>
              ) : (
                <Link
                  href={includeHref}
                  className="text-accent hover:text-accent-hover"
                  data-testid="cip-filter-include-link"
                >
                  Include rows that still need review →
                </Link>
              )}
            </div>
          </CardBody>
        </Card>

        <Card data-testid="cip-records-card">
          <CardHeader
            title={`Reference rows (${rows.length})`}
            description="Each row is metadata transcribed from the cited CIP / Shooters World source. The app never converts any value below into a per-handload pressure prediction or charge recommendation."
            actions={
              <Link
                href="/cip-reference/compare"
                className="text-[12px] text-accent hover:text-accent-hover"
                data-testid="cip-compare-link"
              >
                Compare with a load →
              </Link>
            }
          />
          <CardBody>
            {rows.length === 0 ? (
              <p
                className="text-[13px] text-text-muted"
                data-testid="cip-records-empty"
              >
                No reference rows match this search.{' '}
                {!includeNeedsReview && (
                  <>
                    Imported rows always land as DRAFT — try{' '}
                    <Link
                      href={includeHref}
                      className="text-accent hover:text-accent-hover"
                    >
                      including rows that still need review
                    </Link>
                    , or ask an admin to verify them in{' '}
                    <Link
                      href="/admin/shooters-world-cip"
                      className="text-accent hover:text-accent-hover"
                    >
                      the admin entry workspace
                    </Link>
                    .
                  </>
                )}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full text-[12px]"
                  data-testid="cip-records-table"
                >
                  <thead className="text-left text-text-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Cartridge</th>
                      <th className="py-1 pr-3 font-medium">CASE</th>
                      <th className="py-1 pr-3 font-medium">Bullet wt.</th>
                      <th className="py-1 pr-3 font-medium">Projectile</th>
                      <th className="py-1 pr-3 font-medium">COAL</th>
                      <th className="py-1 pr-3 font-medium">Powder</th>
                      <th className="py-1 pr-3 font-medium">ST load</th>
                      <th className="py-1 pr-3 font-medium">ST vel</th>
                      <th className="py-1 pr-3 font-medium">Max load</th>
                      <th className="py-1 pr-3 font-medium">Max vel</th>
                      <th className="py-1 pr-3 font-medium">
                        Pmax (published)
                      </th>
                      <th className="py-1 pr-3 font-medium">Source</th>
                      <th className="py-1 pr-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {rows.map((r) => {
                      const parsed = parseCipNotes(r.notes);
                      return (
                        <tr
                          key={r.id}
                          className="border-t border-border align-top"
                          data-testid={`cip-row-${r.id}`}
                        >
                          <td className="py-1.5 pr-3">
                            <div className="font-medium">
                              {r.cartridgeName}
                            </div>
                            {r.cartridgeCaliberLabel && (
                              <div className="text-text-faint text-[11px]">
                                {r.cartridgeCaliberLabel}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-text-muted">
                            {dash(parsed.fields['CASE'])}
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums">
                            {dash(parsed.fields['Bullet weight'])}
                          </td>
                          <td className="py-1.5 pr-3">
                            {dash(parsed.fields['Projectile'])}
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums text-text-muted">
                            {dash(parsed.fields['COAL'])}
                          </td>
                          <td className="py-1.5 pr-3">
                            {r.powderManufacturer && (
                              <div className="text-text-muted">
                                {r.powderManufacturer}
                              </div>
                            )}
                            {r.powderName && (
                              <div>
                                {r.powderFamily
                                  ? `${r.powderFamily} · `
                                  : ''}
                                {r.powderName}
                              </div>
                            )}
                            {!r.powderName &&
                              !r.powderFamily &&
                              !r.powderManufacturer && (
                                <span className="text-text-faint">—</span>
                              )}
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums">
                            {dash(parsed.fields['ST load'])}
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums">
                            {dash(parsed.fields['ST vel'])}
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums">
                            {dash(parsed.fields['Max load'])}
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums">
                            {dash(parsed.fields['Max vel'])}
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums">
                            {formatPmax(r.pmaxValue, r.pmaxUnit)}
                            {(r.referenceChamberVolume != null ||
                              r.referenceCombustionVolume != null) && (
                              <div className="text-text-faint text-[11px]">
                                ch{' '}
                                {formatVolume(
                                  r.referenceChamberVolume,
                                  r.volumeUnit,
                                )}{' '}
                                · co{' '}
                                {formatVolume(
                                  r.referenceCombustionVolume,
                                  r.volumeUnit,
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 pr-3">
                            {r.sourceUrl ? (
                              <a
                                href={r.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:text-accent-hover break-all"
                                data-testid={`cip-row-source-link-${r.id}`}
                              >
                                {r.sourceLabel ?? r.sourceUrl}
                              </a>
                            ) : (
                              <Badge tone="warning">source needed</Badge>
                            )}
                            {r.sourceRevision && (
                              <div className="text-text-faint text-[11px]">
                                rev {r.sourceRevision}
                              </div>
                            )}
                            {r.sourceDate && (
                              <div className="text-text-faint text-[11px]">
                                {r.sourceDate.toISOString().slice(0, 10)}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 pr-3">
                            <Badge tone={statusBadgeTone(r.verificationStatus)}>
                              {r.verificationStatus
                                .toLowerCase()
                                .replace('_', ' ')}
                            </Badge>
                            {r.verificationStatus !== 'VERIFIED' && (
                              <div
                                className="text-warning text-[11px] mt-1"
                                data-testid={`cip-row-needs-review-${r.id}`}
                              >
                                Not yet verified against the cited source.
                              </div>
                            )}
                            {parsed.freeText && (
                              <div className="text-text-faint text-[11px] mt-1">
                                {parsed.freeText}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card data-testid="cip-related-links-card">
          <CardHeader
            title="Related workflows"
            description="Where to use these rows once they are verified."
          />
          <CardBody>
            <ul className="text-[13px] text-text-muted space-y-1.5">
              <li>
                <Link
                  href="/cip-reference/compare"
                  className="text-accent hover:text-accent-hover"
                >
                  Compare a saved load against a verified CIP row
                </Link>{' '}
                — readiness notes only, no pressure prediction.
              </li>
              <li>
                <Link
                  href="/admin/model-validation"
                  className="text-accent hover:text-accent-hover"
                >
                  Admin · Model validation
                </Link>{' '}
                — use a verified CIP row as the reference for a validation
                dataset case.
              </li>
              <li>
                <Link
                  href="/safety"
                  className="text-accent hover:text-accent-hover"
                >
                  Safety policy
                </Link>{' '}
                — required reading before relying on any reference row.
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
