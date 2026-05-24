import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  describeUnavailability,
  safeWithWorkspace,
} from '@/lib/db/safeLoad';
import {
  analyzeDataQuality,
  confidenceLabel,
  type DataQualityFinding,
  type Severity,
  type SourceConfidenceKind,
} from '@/lib/analysis/dataQuality';
import { ReviewCenterFilters } from './ReviewCenterFilters';

export const dynamic = 'force-dynamic';

type SearchParams = {
  category?: string;
  severity?: string;
};

function severityTone(s: Severity): 'neutral' | 'warning' | 'danger' {
  if (s === 'critical') return 'danger';
  if (s === 'warning') return 'warning';
  return 'neutral';
}

export default async function DataQualityPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = searchParams ? await searchParams : {};
  const categoryFilter = sp.category ?? '';
  const severityFilter = sp.severity ?? '';

  const result = await safeWithWorkspace(async ({ workspaceId, prisma }) => {
    const [
      loads,
      sources,
      components,
      publishedRows,
      rangeSessions,
      caseCap,
      bulletDim,
      powderMeta,
      barrelGeom,
      chronoCal,
      validationDatasets,
    ] = await Promise.all([
      prisma.load.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          chargeGr: true,
          cartridgeOalIn: true,
          safetyAcknowledged: true,
          sourceId: true,
          sourcePageLabel: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.source.findMany({
        where: { workspaceId },
        select: {
          id: true,
          title: true,
          publisher: true,
          edition: true,
          citation: true,
          publishedYear: true,
        },
      }),
      prisma.component.findMany({
        where: { workspaceId, archived: false },
        select: {
          id: true,
          kind: true,
          manufacturer: true,
          model: true,
          bulletWeightGr: true,
          bulletBc: true,
          burnRateLabel: true,
          lotNumber: true,
        },
      }),
      prisma.publishedLoadRowDraft.findMany({
        where: { workspaceId, status: { not: 'REJECTED' } },
        select: {
          id: true,
          status: true,
          pageLabel: true,
          sourceId: true,
          bulletWeightGr: true,
          chargeGr: true,
          velocityFps: true,
          bulletName: true,
          powderName: true,
          updatedAt: true,
        },
        take: 500,
      }),
      prisma.rangeSession.findMany({
        where: { workspaceId },
        select: {
          id: true,
          loadId: true,
          date: true,
          avgVelocityFps: true,
          shotsFired: true,
          sdFps: true,
          esFps: true,
        },
      }),
      prisma.caseCapacityMeasurement.findMany({
        where: { workspaceId },
        select: { id: true, cartridgeId: true, waterCapacityGr: true, method: true, updatedAt: true },
        take: 200,
      }),
      prisma.bulletDimensionRecord.findMany({
        where: { workspaceId },
        select: { id: true, weightGr: true, diameterIn: true, bcG1: true, updatedAt: true },
        take: 200,
      }),
      prisma.powderMetadataRecord.findMany({
        where: { workspaceId },
        select: { id: true, burnRateLabel: true, sourceId: true, updatedAt: true },
        take: 200,
      }),
      prisma.barrelGeometryRecord.findMany({
        where: { workspaceId },
        select: { id: true, barrelLengthIn: true, twistRate: true, updatedAt: true },
        take: 200,
      }),
      prisma.chronoCalibrationRecord.findMany({
        where: { workspaceId },
        select: { id: true, deviceName: true, updatedAt: true },
        take: 200,
      }),
      prisma.modelValidationDataset.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          status: true,
          acknowledgedValidationOnly: true,
          updatedAt: true,
          _count: { select: { cases: true, runs: true } },
        },
        take: 200,
      }),
    ]);

    return {
      loads,
      sources,
      components,
      publishedRows,
      rangeSessions,
      caseCap,
      bulletDim,
      powderMeta,
      barrelGeom,
      chronoCal,
      validationDatasets,
    };
  });

  if (!result.ok) {
    return (
      <>
        <Topbar title="Data quality review center" />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
          <Card>
            <CardHeader
              title="Reference data quality"
              description="Surfaces missing fields, unverified rows, and incomplete references across your workspace."
            />
            <CardBody>
              <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text">
                <div className="font-medium text-warning mb-1">
                  Review center is unavailable.
                </div>
                <p className="text-text-muted">
                  {describeUnavailability(result.reason)} Once the database is
                  configured and you sign in, this page will scan your loads,
                  sources, components, sessions, published rows, solver
                  inputs, and validation datasets for completeness issues.
                </p>
                <p className="text-text-muted mt-2">
                  This page reports completeness only — it does not certify
                  any load as safe, does not predict pressure, and does not
                  recommend charges.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const data = result.data;
  const solverData = [
    ...data.caseCap.map((r) => ({
      id: r.id,
      kind: 'CaseCapacity' as const,
      label: `Case capacity${r.method ? ` (${r.method})` : ''}`,
      missing: [
        r.waterCapacityGr == null ? 'waterCapacityGr' : null,
        !r.method ? 'method' : null,
      ].filter((x): x is string => x != null),
      updatedAt: r.updatedAt,
      hrefBase: '/solver-inputs',
    })),
    ...data.bulletDim.map((r) => ({
      id: r.id,
      kind: 'BulletDim' as const,
      label: `Bullet dimension`,
      missing: [
        r.weightGr == null ? 'weight' : null,
        r.diameterIn == null ? 'diameter' : null,
        r.bcG1 == null ? 'bcG1' : null,
      ].filter((x): x is string => x != null),
      updatedAt: r.updatedAt,
      hrefBase: '/solver-inputs',
    })),
    ...data.powderMeta.map((r) => ({
      id: r.id,
      kind: 'PowderMeta' as const,
      label: `Powder metadata`,
      missing: [
        !r.burnRateLabel ? 'burnRateLabel' : null,
        !r.sourceId ? 'sourceId' : null,
      ].filter((x): x is string => x != null),
      updatedAt: r.updatedAt,
      hrefBase: '/solver-inputs',
    })),
    ...data.barrelGeom.map((r) => ({
      id: r.id,
      kind: 'BarrelGeom' as const,
      label: `Barrel geometry`,
      missing: [
        r.barrelLengthIn == null ? 'barrelLengthIn' : null,
        !r.twistRate ? 'twistRate' : null,
      ].filter((x): x is string => x != null),
      updatedAt: r.updatedAt,
      hrefBase: '/solver-inputs',
    })),
    ...data.chronoCal.map((r) => ({
      id: r.id,
      kind: 'ChronoCal' as const,
      label: `Chrono calibration`,
      missing: [!r.deviceName ? 'deviceName' : null].filter(
        (x): x is string => x != null,
      ),
      updatedAt: r.updatedAt,
      hrefBase: '/solver-inputs',
    })),
  ];

  const { findings, summary } = analyzeDataQuality({
    loads: data.loads,
    sources: data.sources,
    components: data.components,
    publishedRows: data.publishedRows,
    rangeSessions: data.rangeSessions,
    solverData,
    validationDatasets: data.validationDatasets.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      caseCount: d._count.cases,
      runCount: d._count.runs,
      acknowledgedValidationOnly: d.acknowledgedValidationOnly,
      updatedAt: d.updatedAt,
    })),
  });

  const filtered = findings.filter((f) => {
    if (categoryFilter && f.category !== categoryFilter) return false;
    if (severityFilter && f.severity !== severityFilter) return false;
    return true;
  });

  const categories = Object.keys(summary.byCategory).sort();

  const confidence: Array<{ kind: SourceConfidenceKind; count: number; description: string }> = [
    {
      kind: 'manufacturer-published',
      count: data.sources.filter((s) => s.publisher).length,
      description: 'Sources with a recorded publisher.',
    },
    {
      kind: 'user-entered',
      count: data.loads.length,
      description: 'Loads recorded by you. Citations and observations only.',
    },
    {
      kind: 'chrono-observed',
      count: data.rangeSessions.filter((s) => s.avgVelocityFps != null).length,
      description: 'Range sessions with measured velocity.',
    },
    {
      kind: 'imported',
      count: data.publishedRows.length,
      description: 'Transcribed published rows staged for review.',
    },
    {
      kind: 'verified',
      count: data.publishedRows.filter((r) => r.status === 'VERIFIED').length,
      description: 'Published rows marked verified by a workspace member.',
    },
    {
      kind: 'needs-review',
      count: data.publishedRows.filter((r) => r.status === 'NEEDS_REVIEW').length,
      description: 'Published rows flagged for review against the source.',
    },
    {
      kind: 'validation-only',
      count: data.validationDatasets.length,
      description: 'Admin model-validation datasets. Never used as load guidance.',
    },
  ];

  return (
    <>
      <Topbar
        title="Data quality review center"
        actions={<Badge tone="accent">Completeness only</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="What this page does"
            description="Scans your workspace for missing fields, unverified rows, and duplicates. Findings are about data completeness — not about load safety."
          />
          <CardBody>
            <div className="rounded-md border border-border bg-bg-alt/40 px-4 py-3 text-[12px] text-text-muted">
              <p>
                The review center does <strong>not</strong> certify any load as
                safe, predict pressure, or recommend charges. Safety-critical
                published rows must still be verified by a human against the
                original document before being cited on a load.
              </p>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCell label="Total findings" value={summary.total} />
          <SummaryCell label="Critical" value={summary.bySeverity.critical} tone="danger" />
          <SummaryCell label="Warning" value={summary.bySeverity.warning} tone="warning" />
          <SummaryCell label="Info" value={summary.bySeverity.info} />
        </div>

        <Card>
          <CardHeader
            title="Source confidence overview"
            description="Counts by record origin. These badges help you tell user-entered values from manufacturer-published references and chrono-observed measurements."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {confidence.map((c) => (
                <div
                  key={c.kind}
                  className="rounded-md border border-border bg-bg-alt/30 px-3 py-2.5"
                  data-testid={`confidence-${c.kind}`}
                >
                  <div className="flex items-center justify-between">
                    <Badge tone={badgeToneForConfidence(c.kind)}>
                      {confidenceLabel(c.kind)}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums">
                      {c.count}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Filter findings"
            description="Narrow the list by category or severity. All findings are scoped to your workspace."
          />
          <CardBody>
            <ReviewCenterFilters
              categories={categories}
              category={categoryFilter}
              severity={severityFilter}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={`Findings (${filtered.length}${filtered.length !== findings.length ? ` of ${findings.length}` : ''})`}
            description="Each finding links to a fix-or-review surface. Bulk actions are not available — destructive or safety-critical updates must be made one at a time."
          />
          <CardBody>
            {filtered.length === 0 ? (
              <p className="text-[13px] text-text-muted" data-testid="findings-empty">
                Nothing to review here. Your workspace looks complete for the
                selected filters.
              </p>
            ) : (
              <ul className="divide-y divide-border" data-testid="findings-list">
                {filtered.slice(0, 200).map((f) => (
                  <FindingRow key={f.id} finding={f} />
                ))}
                {filtered.length > 200 && (
                  <li className="py-2 text-[11px] text-text-faint">
                    + {filtered.length - 200} more findings hidden. Use filters
                    to narrow the list.
                  </li>
                )}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              The review center reports completeness signals only. LoadBench Pro
              never auto-verifies published rows, never approves a load, never
              predicts pressure, and never substitutes powders. Safety-critical
              changes must be made by a workspace member.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warning' | 'danger';
}) {
  return (
    <div
      className="rounded-md border border-border bg-bg-surface px-4 py-3"
      data-testid={`summary-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </div>
      <div
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (tone === 'danger'
            ? 'text-danger'
            : tone === 'warning'
              ? 'text-warning'
              : 'text-text')
        }
      >
        {value}
      </div>
    </div>
  );
}

function FindingRow({ finding }: { finding: DataQualityFinding }) {
  return (
    <li className="py-3 flex items-start gap-3" data-testid={`finding-${finding.id}`}>
      <Badge tone={severityTone(finding.severity)}>{finding.severity}</Badge>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text font-medium">{finding.title}</div>
        <p className="text-[12px] text-text-muted mt-0.5">{finding.detail}</p>
        <div className="text-[11px] text-text-faint mt-1">
          <span>{finding.category}</span>
          {' · '}
          <span>{finding.entityType}</span>
        </div>
      </div>
      {finding.fixHref && (
        <Link
          href={finding.fixHref}
          className="text-[12px] text-accent hover:text-accent-hover shrink-0"
        >
          Open →
        </Link>
      )}
    </li>
  );
}

function badgeToneForConfidence(
  kind: SourceConfidenceKind,
): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (kind) {
    case 'manufacturer-published':
      return 'accent';
    case 'verified':
      return 'success';
    case 'needs-review':
      return 'warning';
    case 'rejected':
      return 'danger';
    case 'validation-only':
      return 'warning';
    case 'chrono-observed':
      return 'accent';
    case 'imported':
    case 'user-entered':
    default:
      return 'neutral';
  }
}
