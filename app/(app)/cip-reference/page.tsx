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
  CIP_SAFETY_BOUNDARY_MESSAGE,
  CIP_PRESSURE_PREDICTION_STATUS,
} from '@/lib/validation/cipReference';

export const dynamic = 'force-dynamic';

type SearchParams = {
  cartridge?: string;
  powder?: string;
  manufacturer?: string;
};

function SafetyBanner() {
  return (
    <div
      className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-1"
      data-testid="cip-safety-banner"
    >
      <p>
        <strong className="font-semibold">
          Verified reference data only.
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
        <SafetyBanner />
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

export default async function CipReferencePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters: CipListFilters = {
    cartridge: sp.cartridge?.trim() || null,
    powder: sp.powder?.trim() || null,
    manufacturer: sp.manufacturer?.trim() || null,
    status: 'VERIFIED',
  };

  const result = await safeWithWorkspace(({ workspaceId }) =>
    listVerifiedCipRecords(workspaceId, filters),
  );

  if (!result.ok) {
    return <UnavailableView message={describeUnavailability(result.reason)} />;
  }

  const rows = result.data;

  return (
    <>
      <Topbar
        title="Shooters World / CIP Reference"
        actions={<Badge tone="success">Verified · reference only</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            { label: 'Shooters World / CIP Reference' },
          ]}
        />

        <SafetyBanner />

        <Card data-testid="cip-filters-card">
          <CardHeader
            title="Search"
            description="Filter the verified reference rows by cartridge, powder, or manufacturer. Only rows in the VERIFIED state are shown here."
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
          </CardBody>
        </Card>

        <Card data-testid="cip-records-card">
          <CardHeader
            title={`Verified reference rows (${rows.length})`}
            description="Each row is reference metadata transcribed from the cited CIP / Shooters World source and reviewed by an admin. No pressure prediction is performed against these values."
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
                No verified reference rows match this search. Admins can add
                rows in{' '}
                <Link
                  href="/admin/shooters-world-cip"
                  className="text-accent hover:text-accent-hover"
                >
                  the admin entry workspace
                </Link>
                .
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-text-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Cartridge</th>
                      <th className="py-1 pr-3 font-medium">Powder</th>
                      <th className="py-1 pr-3 font-medium">Pmax (published)</th>
                      <th className="py-1 pr-3 font-medium">Chamber vol.</th>
                      <th className="py-1 pr-3 font-medium">Combustion vol.</th>
                      <th className="py-1 pr-3 font-medium">F · Z · G</th>
                      <th className="py-1 pr-3 font-medium">Source</th>
                      <th className="py-1 pr-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-border align-top"
                        data-testid={`cip-row-${r.id}`}
                      >
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
                          {r.powderName && (
                            <div>
                              {r.powderFamily ? `${r.powderFamily} · ` : ''}
                              {r.powderName}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {formatPmax(r.pmaxValue, r.pmaxUnit)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {formatVolume(r.referenceChamberVolume, r.volumeUnit)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {formatVolume(
                            r.referenceCombustionVolume,
                            r.volumeUnit,
                          )}
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
                              className="text-accent hover:text-accent-hover"
                            >
                              {r.sourceLabel ?? r.sourceUrl}
                            </a>
                          ) : (
                            <span className="text-text-faint">—</span>
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
                            {r.verificationStatus.toLowerCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
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
