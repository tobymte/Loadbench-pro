import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { solverReadinessChecklist } from '@/lib/analysis/pressureReadiness';
import { PressureModelVersionForm } from '@/components/forms/PressureModelVersionForm';
import { PressureValidationRecordForm } from '@/components/forms/PressureValidationRecordForm';
import { LoadReadinessSelector } from '@/components/forms/LoadReadinessSelector';

export const dynamic = 'force-dynamic';

// Experimental validation workspace.
// This page is EXPLICITLY not a pressure predictor, not a charge recommender,
// and not a safety judge. It captures structured notes and reference data so
// that a future, expert-validated internal-ballistics model could one day be
// evaluated. No code path on this route computes pressure values, recommends
// charges, or marks any load as safe/unsafe.

type StatusKey =
  | 'DRAFT'
  | 'READY_FOR_EXPERT_REVIEW'
  | 'BLOCKED'
  | 'VALIDATED_REFERENCE'
  | 'REJECTED';

const STATUS_LABEL: Record<StatusKey, string> = {
  DRAFT: 'Draft',
  READY_FOR_EXPERT_REVIEW: 'Ready for expert review',
  BLOCKED: 'Blocked',
  VALIDATED_REFERENCE: 'Validated reference',
  REJECTED: 'Rejected',
};

function statusTone(
  s: StatusKey,
): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (s) {
    case 'DRAFT':
      return 'neutral';
    case 'READY_FOR_EXPERT_REVIEW':
      return 'accent';
    case 'BLOCKED':
      return 'warning';
    case 'VALIDATED_REFERENCE':
      return 'success';
    case 'REJECTED':
      return 'danger';
  }
}

function checklistTone(
  status: 'planned' | 'in-progress' | 'blocked' | 'complete',
): 'neutral' | 'accent' | 'success' | 'warning' {
  if (status === 'complete') return 'success';
  if (status === 'in-progress') return 'accent';
  if (status === 'blocked') return 'warning';
  return 'neutral';
}

export default async function PressureModelingTestBenchPage() {
  const ctx = await getWorkspaceContext();

  const [
    loads,
    sources,
    modelVersions,
    validationRecords,
    caseCapacityCount,
    bulletDimensionCount,
    powderMetadataCount,
    barrelGeometryCount,
    chronoCalibrationCount,
  ] = await Promise.all([
    prisma.load.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.source.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    }),
    prisma.pressureModelVersion.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.pressureValidationRecord.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        load: { select: { id: true, name: true } },
        source: { select: { id: true, title: true } },
        modelVersion: { select: { id: true, name: true } },
      },
    }),
    prisma.caseCapacityMeasurement.count({
      where: { workspaceId: ctx.workspaceId },
    }),
    prisma.bulletDimensionRecord.count({
      where: { workspaceId: ctx.workspaceId },
    }),
    prisma.powderMetadataRecord.count({
      where: { workspaceId: ctx.workspaceId },
    }),
    prisma.barrelGeometryRecord.count({
      where: { workspaceId: ctx.workspaceId },
    }),
    prisma.chronoCalibrationRecord.count({
      where: { workspaceId: ctx.workspaceId },
    }),
  ]);

  const solverInputCounts = {
    caseCapacity: caseCapacityCount,
    bulletDimensions: bulletDimensionCount,
    powderMetadata: powderMetadataCount,
    barrelGeometry: barrelGeometryCount,
    chronoCalibration: chronoCalibrationCount,
  };

  const checklist = solverReadinessChecklist();

  return (
    <>
      <Topbar
        title="Pressure modeling test bench"
        actions={<Badge tone="warning">Experimental</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
          data-testid="pressure-modeling-warning"
        >
          <strong className="font-semibold">
            Experimental validation workspace — not a pressure predictor, not
            load advice.
          </strong>{' '}
          Nothing on this page computes pressure, recommends a charge, or marks
          any load as safe or unsafe. Records here are structured notes the
          team uses to build the validation infrastructure a future
          internal-ballistics model would have to pass before it could ever be
          enabled. See the{' '}
          <Link href="/safety" className="text-accent hover:text-accent-hover">
            safety policy
          </Link>
          .
        </div>

        <Card>
          <CardHeader
            title="Solver readiness checklist"
            description="Project-level gates that must be passed before any pressure solver could be considered for enablement. Documentation, not a toggle."
          />
          <CardBody>
            <ul
              className="space-y-3"
              data-testid="solver-readiness-checklist"
            >
              {checklist.map((item) => (
                <li
                  key={item.key}
                  className="border-l-2 border-border pl-4 py-1"
                  data-testid={`solver-readiness-${item.key}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">
                      {item.label}
                    </span>
                    <Badge tone={checklistTone(item.status)}>
                      {item.status}
                    </Badge>
                  </div>
                  {item.detail && (
                    <p className="mt-1 text-[12px] text-text-muted leading-relaxed">
                      {item.detail}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Solver input record counts"
            description="Counts of workspace-scoped solver-input records. Counts only — no pressure math, no charge advice."
            actions={
              <Link
                href="/solver-inputs"
                className="text-[12px] text-accent hover:text-accent-hover"
              >
                Manage records →
              </Link>
            }
          />
          <CardBody>
            <ul
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              data-testid="solver-input-counts"
            >
              {[
                {
                  key: 'case-capacity',
                  label: 'Case capacity measurements',
                  count: solverInputCounts.caseCapacity,
                },
                {
                  key: 'bullet-dimensions',
                  label: 'Bullet dimension records',
                  count: solverInputCounts.bulletDimensions,
                },
                {
                  key: 'powder-metadata',
                  label: 'Powder metadata records',
                  count: solverInputCounts.powderMetadata,
                },
                {
                  key: 'barrel-geometry',
                  label: 'Barrel geometry records',
                  count: solverInputCounts.barrelGeometry,
                },
                {
                  key: 'chrono-calibration',
                  label: 'Chrono calibration records',
                  count: solverInputCounts.chronoCalibration,
                },
              ].map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between border-l-2 border-border pl-4 py-1"
                  data-testid={`solver-input-count-${item.key}`}
                >
                  <span className="text-[13px] text-text">{item.label}</span>
                  <Badge tone={item.count > 0 ? 'success' : 'neutral'}>
                    {item.count}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-text-faint">
              Counts here describe how much measurement / metadata coverage
              exists. They do not imply any load is ready, recommended, or
              safe.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Load input completeness"
            description="Pick a load to see which inputs a future model would need. This is a readiness checklist, not a pressure prediction."
          />
          <CardBody>
            {loads.length === 0 ? (
              <p className="text-[12px] text-text-muted">
                No loads in this workspace yet. Record a load first to assess
                input completeness.
              </p>
            ) : (
              <LoadReadinessSelector loads={loads} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Capture a validation dataset row"
            description="Record user-entered published or lab-measured reference data. These rows are inputs to a future calibration check — never outputs of one."
            actions={<Badge tone="warning">Acknowledgement required</Badge>}
          />
          <CardBody>
            <PressureValidationRecordForm
              loads={loads}
              sources={sources}
              modelVersions={modelVersions.map((m) => ({
                id: m.id,
                name: m.name,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Model version registry"
            description="A list of candidate model identities and their review status. Versions are documentation; this app does not execute any of them."
          />
          <CardBody>
            <div className="space-y-6">
              <PressureModelVersionForm />

              {modelVersions.length === 0 ? (
                <p className="text-[12px] text-text-muted">
                  No model versions recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table data-testid="pressure-model-versions-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Description</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelVersions.map((m) => (
                        <tr key={m.id}>
                          <td className="text-text">{m.name}</td>
                          <td>
                            <Badge tone={statusTone(m.status as StatusKey)}>
                              {STATUS_LABEL[m.status as StatusKey]}
                            </Badge>
                          </td>
                          <td className="text-text-muted">
                            {m.description ?? '—'}
                          </td>
                          <td className="text-text-faint">
                            {new Date(m.updatedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Test run log"
            description="Status of each validation dataset row. Computed pressure values are intentionally not displayed."
            actions={<Badge tone="neutral">Status only</Badge>}
          />
          <CardBody>
            {validationRecords.length === 0 ? (
              <p
                className="text-[12px] text-text-muted"
                data-testid="pressure-validation-empty"
              >
                No validation records yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table data-testid="pressure-validation-records-table">
                  <thead>
                    <tr>
                      <th>Reference label</th>
                      <th>Status</th>
                      <th>Load</th>
                      <th>Source</th>
                      <th>Model version</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="text-text">{r.referenceLabel}</td>
                        <td>
                          <Badge tone={statusTone(r.status as StatusKey)}>
                            {STATUS_LABEL[r.status as StatusKey]}
                          </Badge>
                        </td>
                        <td className="text-text-muted">
                          {r.load?.name ?? '—'}
                        </td>
                        <td className="text-text-muted">
                          {r.source?.title ?? '—'}
                        </td>
                        <td className="text-text-muted">
                          {r.modelVersion?.name ?? '—'}
                        </td>
                        <td className="text-text-faint">
                          {new Date(r.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-text-faint">
              This log intentionally omits any computed pressure prediction.
              Statuses describe review state only — never safety.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              This page is a structured note-taking surface for experimental
              pressure-modeling validation. It does not predict pressure,
              recommend charges, propose powder substitutions, or certify any
              load. Until expert validation, documented variance bounds, and
              corpus coverage are all in place, no solver will be enabled.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
