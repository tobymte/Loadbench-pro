import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { safeWithWorkspace, describeUnavailability } from '@/lib/db/safeLoad';
import {
  listVerifiedCipRecords,
  getVerifiedCipRecord,
} from '@/lib/validation/cipReferenceDb';
import {
  formatPmax,
  formatVolume,
  CIP_SAFETY_BOUNDARY_MESSAGE,
  CIP_PRESSURE_PREDICTION_STATUS,
} from '@/lib/validation/cipReference';

export const dynamic = 'force-dynamic';

type SearchParams = { recordId?: string; loadId?: string };

type Load = {
  id: string;
  name: string;
  chargeGr: number | null;
  cartridgeOalIn: number | null;
  caseTrimLengthIn: number | null;
  safetyAcknowledged: boolean;
  cartridge: { name: string };
  bullet: { manufacturer: string; model: string };
  powder: { manufacturer: string; model: string };
};

function describeComponent(c: {
  manufacturer: string;
  model: string;
}): string {
  return `${c.manufacturer} ${c.model}`.trim();
}

function SafetyBanner() {
  return (
    <div
      className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text space-y-1"
      data-testid="cip-compare-safety-banner"
    >
      <p>
        <strong className="font-semibold">
          Comparison panel — readiness notes only.
        </strong>{' '}
        {CIP_SAFETY_BOUNDARY_MESSAGE}
      </p>
      <p className="text-[12px] text-text-muted">
        <code className="text-accent">
          pressurePredictionStatus: &quot;{CIP_PRESSURE_PREDICTION_STATUS}&quot;
        </code>
        . No PSI is computed, predicted, or implied from any field below.
      </p>
    </div>
  );
}

function readinessNotes(record: {
  pmaxValue: number | null;
  pmaxUnit: string | null;
  referenceChamberVolume: number | null;
  referenceCombustionVolume: number | null;
  volumeUnit: string | null;
  riflingF: number | null;
  riflingZ: number | null;
  riflingG: number | null;
  sourceUrl: string | null;
}): string[] {
  const notes: string[] = [];
  if (record.pmaxValue == null || !record.pmaxUnit) {
    notes.push('Reference Pmax / unit not populated on this row.');
  }
  if (record.referenceChamberVolume == null) {
    notes.push('Reference chamber volume missing.');
  }
  if (record.referenceCombustionVolume == null) {
    notes.push('Reference combustion volume missing.');
  }
  if (!record.volumeUnit) {
    notes.push('Volume unit not specified.');
  }
  if (
    record.riflingF == null ||
    record.riflingZ == null ||
    record.riflingG == null
  ) {
    notes.push('Rifling geometry incomplete (F, Z, G).');
  }
  if (!record.sourceUrl) {
    notes.push('Source URL missing — re-verify against the published source.');
  }
  return notes;
}

function loadReadinessNotes(load: Load | null): string[] {
  if (!load) return ['No saved load selected for the right-hand panel.'];
  const notes: string[] = [];
  if (load.chargeGr == null) notes.push('Load charge weight is not captured.');
  if (load.cartridgeOalIn == null) notes.push('Cartridge OAL is not captured.');
  if (!load.safetyAcknowledged) {
    notes.push('Safety acknowledgement has not been checked on this load.');
  }
  return notes;
}

export default async function CipComparePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const data = await safeWithWorkspace(async ({ workspaceId, prisma }) => {
    const records = await listVerifiedCipRecords(workspaceId);
    const record = sp.recordId
      ? await getVerifiedCipRecord(workspaceId, sp.recordId)
      : null;
    const loads = await prisma.load.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        cartridge: { select: { name: true } },
        bullet: { select: { manufacturer: true, model: true } },
        powder: { select: { manufacturer: true, model: true } },
      },
    });
    const load = sp.loadId
      ? loads.find((l) => l.id === sp.loadId) ?? null
      : null;
    return { records, record, loads, load };
  });

  if (!data.ok) {
    return (
      <>
        <Topbar
          title="CIP Reference · Compare"
          actions={<Badge tone="warning">Unavailable</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
          <SafetyBanner />
          <Card>
            <CardBody>
              <p className="text-[13px] text-text-muted">
                {describeUnavailability(data.reason)}
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const { records, record, loads, load } = data.data;
  const recordReadiness = record ? readinessNotes(record) : [];
  const loadReadiness = loadReadinessNotes(load as Load | null);

  return (
    <>
      <Topbar
        title="CIP Reference · Compare"
        actions={<Badge tone="accent">Readiness · reference only</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/cip-reference', label: 'Shooters World / CIP Reference' },
            { label: 'Compare' },
          ]}
        />

        <SafetyBanner />

        <Card data-testid="cip-compare-picker-card">
          <CardHeader
            title="Choose what to compare"
            description="Pick a verified CIP row on the left and one of your saved loads on the right. Switching either rebuilds the readiness notes — never a pressure prediction."
          />
          <CardBody>
            <form
              method="get"
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              data-testid="cip-compare-form"
            >
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Verified CIP row</span>
                <select
                  name="recordId"
                  defaultValue={sp.recordId ?? ''}
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                >
                  <option value="">— Select —</option>
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.cartridgeName}
                      {r.powderName ? ` · ${r.powderName}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Saved load</span>
                <select
                  name="loadId"
                  defaultValue={sp.loadId ?? ''}
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                >
                  <option value="">— Select —</option>
                  {loads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {l.cartridge.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="h-8 px-3 rounded bg-accent text-bg text-[12px] font-medium hover:bg-accent-hover"
                  data-testid="cip-compare-submit"
                >
                  Compare
                </button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card data-testid="cip-compare-record">
            <CardHeader
              title="Published reference (verified)"
              description={
                record
                  ? `Source: ${record.sourceLabel ?? record.sourceUrl ?? 'unspecified'}`
                  : 'No CIP row selected.'
              }
            />
            <CardBody>
              {record ? (
                <dl className="text-[13px] grid grid-cols-[160px_1fr] gap-y-1.5 gap-x-2">
                  <dt className="text-text-muted">Cartridge</dt>
                  <dd>{record.cartridgeName}</dd>
                  <dt className="text-text-muted">Powder</dt>
                  <dd>
                    {[
                      record.powderManufacturer,
                      record.powderFamily,
                      record.powderName,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </dd>
                  <dt className="text-text-muted">Pmax (published)</dt>
                  <dd className="tabular-nums">
                    {formatPmax(record.pmaxValue, record.pmaxUnit)}
                  </dd>
                  <dt className="text-text-muted">Chamber volume</dt>
                  <dd className="tabular-nums">
                    {formatVolume(
                      record.referenceChamberVolume,
                      record.volumeUnit,
                    )}
                  </dd>
                  <dt className="text-text-muted">Combustion volume</dt>
                  <dd className="tabular-nums">
                    {formatVolume(
                      record.referenceCombustionVolume,
                      record.volumeUnit,
                    )}
                  </dd>
                  <dt className="text-text-muted">Rifling F · Z · G</dt>
                  <dd className="tabular-nums">
                    {[record.riflingF, record.riflingZ, record.riflingG]
                      .map((v) => (v == null ? '—' : String(v)))
                      .join(' · ')}
                  </dd>
                  <dt className="text-text-muted">Source</dt>
                  <dd>
                    {record.sourceUrl ? (
                      <a
                        href={record.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent-hover"
                      >
                        {record.sourceLabel ?? record.sourceUrl}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </dl>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Pick a row above to populate this panel.
                </p>
              )}

              {recordReadiness.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wider text-text-faint mb-1">
                    Readiness notes
                  </div>
                  <ul className="list-disc pl-5 text-[12px] text-text-muted space-y-0.5">
                    {recordReadiness.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <Card data-testid="cip-compare-load">
            <CardHeader
              title="Saved load context"
              description={
                load
                  ? `${load.name} · ${load.cartridge.name}`
                  : 'No saved load selected.'
              }
            />
            <CardBody>
              {load ? (
                <dl className="text-[13px] grid grid-cols-[160px_1fr] gap-y-1.5 gap-x-2">
                  <dt className="text-text-muted">Cartridge</dt>
                  <dd>{load.cartridge.name}</dd>
                  <dt className="text-text-muted">Bullet</dt>
                  <dd>{describeComponent(load.bullet)}</dd>
                  <dt className="text-text-muted">Powder</dt>
                  <dd>{describeComponent(load.powder)}</dd>
                  <dt className="text-text-muted">Charge (gr)</dt>
                  <dd className="tabular-nums">
                    {load.chargeGr ?? '—'}
                  </dd>
                  <dt className="text-text-muted">OAL (in)</dt>
                  <dd className="tabular-nums">
                    {load.cartridgeOalIn ?? '—'}
                  </dd>
                  <dt className="text-text-muted">Case trim (in)</dt>
                  <dd className="tabular-nums">
                    {load.caseTrimLengthIn ?? '—'}
                  </dd>
                  <dt className="text-text-muted">Safety acknowledged</dt>
                  <dd>{load.safetyAcknowledged ? 'Yes' : 'No'}</dd>
                </dl>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Pick a saved load above to populate this panel.
                </p>
              )}

              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wider text-text-faint mb-1">
                  Readiness notes
                </div>
                <ul className="list-disc pl-5 text-[12px] text-text-muted space-y-0.5">
                  {loadReadiness.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card data-testid="cip-compare-status-card">
          <CardHeader
            title="What this comparison does NOT do"
            description="A short, explicit recap of the safety boundary."
          />
          <CardBody>
            <ul className="list-disc pl-5 text-[12px] text-text-muted space-y-0.5">
              <li>
                Does not predict chamber pressure for this load or any other
                load.
              </li>
              <li>
                Does not output PSI / peak pressure / MAP for the saved load.
              </li>
              <li>
                Does not recommend a charge, increase, decrease, or
                substitution.
              </li>
              <li>Does not issue a safe / unsafe verdict.</li>
              <li>
                Surfaces only published metadata from the cited source plus
                readiness notes about which fields are missing.
              </li>
            </ul>
            <p className="text-[12px] text-text-faint mt-3">
              <code className="text-accent">
                pressurePredictionStatus: &quot;
                {CIP_PRESSURE_PREDICTION_STATUS}&quot;
              </code>
              . See{' '}
              <Link
                href="/safety"
                className="text-accent hover:text-accent-hover"
              >
                safety policy
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
