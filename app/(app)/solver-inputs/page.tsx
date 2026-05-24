import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  CaseCapacityForm,
  BulletDimensionForm,
  PowderMetadataForm,
  BarrelGeometryForm,
  ChronoCalibrationForm,
} from '@/components/forms/SolverInputForms';

export const dynamic = 'force-dynamic';

// Solver-input data capture page.
// This page is data capture only. Nothing here computes pressure, recommends a
// charge, or marks any load as safe or unsafe. The records are measurements
// and metadata that a future, expert-validated solver could one day consume.

export default async function SolverInputsPage() {
  const ctx = await getWorkspaceContext();

  const [
    cartridges,
    loads,
    cases,
    bullets,
    powders,
    rifles,
    sources,
    caseCapacityRows,
    bulletDimensionRows,
    powderMetadataRows,
    barrelGeometryRows,
    chronoCalibrationRows,
  ] = await Promise.all([
    prisma.cartridge.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.load.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.component.findMany({
      where: { workspaceId: ctx.workspaceId, kind: 'CASE' },
      orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
      select: { id: true, manufacturer: true, model: true },
    }),
    prisma.component.findMany({
      where: { workspaceId: ctx.workspaceId, kind: 'BULLET' },
      orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
      select: { id: true, manufacturer: true, model: true },
    }),
    prisma.component.findMany({
      where: { workspaceId: ctx.workspaceId, kind: 'POWDER' },
      orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
      select: { id: true, manufacturer: true, model: true },
    }),
    prisma.rifle.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.source.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    }),
    prisma.caseCapacityMeasurement.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: {
        cartridge: { select: { id: true, name: true } },
        load: { select: { id: true, name: true } },
        brassComponent: {
          select: { id: true, manufacturer: true, model: true },
        },
      },
    }),
    prisma.bulletDimensionRecord.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: {
        component: {
          select: { id: true, manufacturer: true, model: true },
        },
      },
    }),
    prisma.powderMetadataRecord.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: {
        component: {
          select: { id: true, manufacturer: true, model: true },
        },
        source: { select: { id: true, title: true } },
      },
    }),
    prisma.barrelGeometryRecord.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: { rifle: { select: { id: true, name: true } } },
    }),
    prisma.chronoCalibrationRecord.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: {
        referenceLoad: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <>
      <Topbar
        title="Solver inputs"
        actions={<Badge tone="warning">Data capture only</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
          data-testid="solver-inputs-notice"
        >
          <strong className="font-semibold">
            Solver inputs are measurements and metadata for future validation.
          </strong>{' '}
          They do not produce pressure estimates or load advice. Nothing on
          this page computes pressure, recommends a charge, or marks any load
          as safe or unsafe. See the{' '}
          <Link href="/safety" className="text-accent hover:text-accent-hover">
            safety policy
          </Link>
          .
        </div>

        <Card>
          <CardHeader
            title="Case capacity measurements"
            description="Water-fill or alcohol-fill capacity measurements for brass cases. Stored as user-entered numbers; no formula reads from them."
          />
          <CardBody>
            <CaseCapacityForm
              cartridges={cartridges}
              loads={loads}
              cases={cases}
            />
            <RecentList
              testId="solver-input-case-capacity-recent"
              empty="No case capacity measurements yet."
              rows={caseCapacityRows.map((r) => ({
                id: r.id,
                primary: r.cartridge?.name ?? r.lotNumber ?? 'Capacity record',
                secondary: [
                  r.brassComponent
                    ? `${r.brassComponent.manufacturer} ${r.brassComponent.model}`
                    : null,
                  r.method,
                  r.firedOrResized,
                  r.avgCapacityGr != null
                    ? `avg ${r.avgCapacityGr} gr`
                    : r.waterCapacityGr != null
                      ? `${r.waterCapacityGr} gr H₂O`
                      : null,
                  r.sampleCount != null ? `n=${r.sampleCount}` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
                updatedAt: r.updatedAt,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Bullet dimensions"
            description="User-entered bullet measurements. Stored for future calibration; no ballistics computation reads from these."
          />
          <CardBody>
            <BulletDimensionForm bullets={bullets} />
            <RecentList
              testId="solver-input-bullet-dimensions-recent"
              empty="No bullet dimension records yet."
              rows={bulletDimensionRows.map((r) => ({
                id: r.id,
                primary:
                  r.component
                    ? `${r.component.manufacturer} ${r.component.model}`
                    : [r.manufacturer, r.model].filter(Boolean).join(' ') ||
                      'Bullet record',
                secondary: [
                  r.weightGr != null ? `${r.weightGr} gr` : null,
                  r.diameterIn != null ? `${r.diameterIn}"` : null,
                  r.lengthIn != null ? `${r.lengthIn}" oal` : null,
                  r.bcG1 != null ? `G1 ${r.bcG1}` : null,
                  r.bcG7 != null ? `G7 ${r.bcG7}` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
                updatedAt: r.updatedAt,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Powder metadata"
            description="Powder identity, density, and burn characteristics. Metadata only — no charge calculations."
          />
          <CardBody>
            <PowderMetadataForm powders={powders} sources={sources} />
            <RecentList
              testId="solver-input-powder-metadata-recent"
              empty="No powder metadata records yet."
              rows={powderMetadataRows.map((r) => ({
                id: r.id,
                primary:
                  [r.manufacturer, r.powderName].filter(Boolean).join(' ') ||
                  (r.component
                    ? `${r.component.manufacturer} ${r.component.model}`
                    : 'Powder record'),
                secondary: [
                  r.burnRateLabel,
                  r.densityGcc != null ? `${r.densityGcc} g/cc` : null,
                  r.bulkDensityGrPerCc != null
                    ? `${r.bulkDensityGrPerCc} gr/cc bulk`
                    : null,
                  r.kernelShape,
                  r.source ? `cite: ${r.source.title}` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
                updatedAt: r.updatedAt,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Barrel geometry"
            description="Barrel and chamber geometry. Notes and dimensions only."
          />
          <CardBody>
            <BarrelGeometryForm rifles={rifles} />
            <RecentList
              testId="solver-input-barrel-geometry-recent"
              empty="No barrel geometry records yet."
              rows={barrelGeometryRows.map((r) => ({
                id: r.id,
                primary:
                  r.name ??
                  (r.rifle ? r.rifle.name : 'Barrel record'),
                secondary: [
                  r.rifle ? r.rifle.name : null,
                  r.barrelLengthIn != null ? `${r.barrelLengthIn}"` : null,
                  r.twistRate,
                  r.boreDiameterIn != null
                    ? `bore ${r.boreDiameterIn}"`
                    : null,
                  r.grooveDiameterIn != null
                    ? `groove ${r.grooveDiameterIn}"`
                    : null,
                  r.freeboreIn != null ? `freebore ${r.freeboreIn}"` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
                updatedAt: r.updatedAt,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Chronograph calibration"
            description="Calibration log for chronograph devices. Reference vs observed velocity is a device-tracking measurement, not a load recommendation."
          />
          <CardBody>
            <ChronoCalibrationForm loads={loads} />
            <RecentList
              testId="solver-input-chrono-calibration-recent"
              empty="No chrono calibration records yet."
              rows={chronoCalibrationRows.map((r) => ({
                id: r.id,
                primary:
                  [r.deviceName, r.deviceType].filter(Boolean).join(' ') ||
                  'Chrono calibration',
                secondary: [
                  r.serialNumber ? `sn ${r.serialNumber}` : null,
                  r.firmwareVersion ? `fw ${r.firmwareVersion}` : null,
                  r.calibrationDate
                    ? new Date(r.calibrationDate).toLocaleDateString()
                    : null,
                  r.referenceLoad ? `ref load: ${r.referenceLoad.name}` : null,
                  r.referenceVelocityFps != null
                    ? `ref ${r.referenceVelocityFps} fps`
                    : null,
                  r.observedVelocityFps != null
                    ? `obs ${r.observedVelocityFps} fps`
                    : null,
                  r.offsetFps != null ? `Δ ${r.offsetFps} fps` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
                updatedAt: r.updatedAt,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              Solver inputs are stored as structured measurements and metadata.
              This page does not compute pressure, recommend a charge, or label
              any load as safe or unsafe. Until expert-validated methodology
              and review are in place, no solver will read from these records.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

type RecentRow = {
  id: string;
  primary: string;
  secondary: string;
  updatedAt: Date;
};

function RecentList({
  rows,
  empty,
  testId,
}: {
  rows: RecentRow[];
  empty: string;
  testId: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-text-muted mt-4" data-testid={testId}>
        {empty}
      </p>
    );
  }
  return (
    <ul className="mt-5 divide-y divide-border" data-testid={testId}>
      {rows.map((r) => (
        <li key={r.id} className="py-2 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-text truncate">{r.primary}</div>
            {r.secondary && (
              <div className="text-[11px] text-text-muted truncate">
                {r.secondary}
              </div>
            )}
          </div>
          <div className="text-[11px] text-text-faint shrink-0">
            {new Date(r.updatedAt).toLocaleString()}
          </div>
        </li>
      ))}
    </ul>
  );
}
