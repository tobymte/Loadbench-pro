import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { getAdminContext } from '@/lib/auth/admin';
import { csvResponse, csvUnavailable, type CsvValue } from '@/lib/data/csv';

// /api/export/csv/[entity]
//
// Safe-data CSV exports for backup and portability. Every supported entity
// is workspace-scoped through getWorkspaceContext(); admin-only entities
// additionally require LOADBENCH_ADMIN_EMAILS membership. None of these
// exports emit secrets, env-vars, or pressure/charge predictions — they
// emit user-entered data already visible in the UI.

export const dynamic = 'force-dynamic';

type EntityDef = {
  filename: string;
  adminOnly?: boolean;
  fetch: (wid: string) => Promise<{ headers: string[]; rows: CsvValue[][] }>;
};

function date(d: Date | null | undefined): string {
  return d ? d.toISOString() : '';
}

const ENTITIES: Record<string, EntityDef> = {
  cartridges: {
    filename: 'cartridges.csv',
    fetch: async (wid) => {
      const rows = await prisma.cartridge.findMany({
        where: { workspaceId: wid },
        orderBy: { name: 'asc' },
      });
      return {
        headers: [
          'id',
          'name',
          'saami',
          'caseCapacityGrH2O',
          'maxPressurePsi',
          'bulletDiameterIn',
          'notes',
          'createdAt',
          'updatedAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.name,
          r.saami,
          r.caseCapacityGrH2O,
          r.maxPressurePsi,
          r.bulletDiameterIn,
          r.notes,
          date(r.createdAt),
          date(r.updatedAt),
        ]),
      };
    },
  },
  components: {
    filename: 'components-inventory.csv',
    fetch: async (wid) => {
      const rows = await prisma.component.findMany({
        where: { workspaceId: wid },
        orderBy: [{ kind: 'asc' }, { manufacturer: 'asc' }, { model: 'asc' }],
      });
      return {
        headers: [
          'id',
          'kind',
          'manufacturer',
          'model',
          'lotNumber',
          'bulletWeightGr',
          'bulletBc',
          'burnRateLabel',
          'quantityOnHand',
          'unit',
          'lowStockThreshold',
          'archived',
          'notes',
          'createdAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.kind,
          r.manufacturer,
          r.model,
          r.lotNumber,
          r.bulletWeightGr,
          r.bulletBc,
          r.burnRateLabel,
          r.quantityOnHand,
          r.unit,
          r.lowStockThreshold,
          r.archived,
          r.notes,
          date(r.createdAt),
        ]),
      };
    },
  },
  loads: {
    filename: 'loads.csv',
    fetch: async (wid) => {
      const rows = await prisma.load.findMany({
        where: { workspaceId: wid },
        include: {
          cartridge: { select: { name: true } },
          bullet: { select: { manufacturer: true, model: true } },
          powder: { select: { manufacturer: true, model: true } },
          source: { select: { title: true, publisher: true, edition: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        headers: [
          'id',
          'name',
          'status',
          'cartridge',
          'bullet',
          'powder',
          'chargeGr',
          'cartridgeOalIn',
          'cartridgeBaseToOgiveIn',
          'caseTrimLengthIn',
          'neckTensionThou',
          'publishedMaxChargeGr',
          'sourceTitle',
          'sourcePublisher',
          'sourceEdition',
          'sourcePageLabel',
          'safetyAcknowledged',
          'safetyNotes',
          'notes',
          'createdAt',
          'updatedAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.name,
          r.status,
          r.cartridge?.name ?? null,
          r.bullet ? `${r.bullet.manufacturer} ${r.bullet.model}` : null,
          r.powder ? `${r.powder.manufacturer} ${r.powder.model}` : null,
          r.chargeGr,
          r.cartridgeOalIn,
          r.cartridgeBaseToOgiveIn,
          r.caseTrimLengthIn,
          r.neckTensionThou,
          r.publishedMaxChargeGr,
          r.source?.title ?? null,
          r.source?.publisher ?? null,
          r.source?.edition ?? null,
          r.sourcePageLabel,
          r.safetyAcknowledged,
          r.safetyNotes,
          r.notes,
          date(r.createdAt),
          date(r.updatedAt),
        ]),
      };
    },
  },
  sources: {
    filename: 'sources.csv',
    fetch: async (wid) => {
      const rows = await prisma.source.findMany({
        where: { workspaceId: wid },
        orderBy: { title: 'asc' },
      });
      return {
        headers: [
          'id',
          'title',
          'publisher',
          'edition',
          'publishedYear',
          'url',
          'citation',
          'publishedMaxGr',
          'notes',
          'createdAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.title,
          r.publisher,
          r.edition,
          r.publishedYear,
          r.url,
          r.citation,
          r.publishedMaxGr,
          r.notes,
          date(r.createdAt),
        ]),
      };
    },
  },
  rifles: {
    filename: 'rifles.csv',
    fetch: async (wid) => {
      const rows = await prisma.rifle.findMany({
        where: { workspaceId: wid },
        orderBy: { name: 'asc' },
      });
      return {
        headers: [
          'id',
          'name',
          'manufacturer',
          'model',
          'createdAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.name,
          r.manufacturer,
          r.model,
          date(r.createdAt),
        ]),
      };
    },
  },
  sessions: {
    filename: 'range-sessions.csv',
    fetch: async (wid) => {
      const rows = await prisma.rangeSession.findMany({
        where: { workspaceId: wid },
        include: {
          load: { select: { name: true } },
          rifle: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      });
      return {
        headers: [
          'id',
          'date',
          'load',
          'rifle',
          'location',
          'shotsFired',
          'avgVelocityFps',
          'esFps',
          'sdFps',
          'groupSizeIn',
          'groupDistanceYd',
          'tempF',
          'humidityPct',
          'pressureInHg',
          'windMph',
          'notes',
        ],
        rows: rows.map((r) => [
          r.id,
          date(r.date),
          r.load?.name ?? null,
          r.rifle?.name ?? null,
          r.location,
          r.shotsFired,
          r.avgVelocityFps,
          r.esFps,
          r.sdFps,
          r.groupSizeIn,
          r.groupDistanceYd,
          r.tempF,
          r.humidityPct,
          r.pressureInHg,
          r.windMph,
          r.notes,
        ]),
      };
    },
  },
  'published-rows': {
    filename: 'published-data-rows.csv',
    fetch: async (wid) => {
      const rows = await prisma.publishedLoadRowDraft.findMany({
        where: { workspaceId: wid },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: [
          'id',
          'status',
          'sourceId',
          'cartridgeId',
          'bulletName',
          'powderName',
          'bulletWeightGr',
          'chargeGr',
          'velocityFps',
          'isMaxLoad',
          'publishedMaxChargeGr',
          'colIn',
          'bcG1',
          'bcG7',
          'pageLabel',
          'notes',
          'verifiedAt',
          'createdAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.status,
          r.sourceId,
          r.cartridgeId,
          r.bulletName,
          r.powderName,
          r.bulletWeightGr,
          r.chargeGr,
          r.velocityFps,
          r.isMaxLoad,
          r.publishedMaxChargeGr,
          r.colIn,
          r.bcG1,
          r.bcG7,
          r.pageLabel,
          r.notes,
          date(r.verifiedAt),
          date(r.createdAt),
        ]),
      };
    },
  },
  'solver-inputs': {
    filename: 'solver-inputs.csv',
    fetch: async (wid) => {
      const [caseCap, bullet, powder, barrel, chrono] = await Promise.all([
        prisma.caseCapacityMeasurement.findMany({ where: { workspaceId: wid } }),
        prisma.bulletDimensionRecord.findMany({ where: { workspaceId: wid } }),
        prisma.powderMetadataRecord.findMany({ where: { workspaceId: wid } }),
        prisma.barrelGeometryRecord.findMany({ where: { workspaceId: wid } }),
        prisma.chronoCalibrationRecord.findMany({ where: { workspaceId: wid } }),
      ]);
      const headers = ['recordType', 'id', 'summary', 'createdAt'];
      const norm = <T extends { id: string; createdAt: Date }>(
        kind: string,
        items: T[],
        summarize: (x: T) => string,
      ): CsvValue[][] =>
        items.map((x) => [kind, x.id, summarize(x), date(x.createdAt)]);
      return {
        headers,
        rows: [
          ...norm('caseCapacity', caseCap, (x) => JSON.stringify(x)),
          ...norm('bulletDim', bullet, (x) => JSON.stringify(x)),
          ...norm('powderMeta', powder, (x) => JSON.stringify(x)),
          ...norm('barrelGeo', barrel, (x) => JSON.stringify(x)),
          ...norm('chronoCal', chrono, (x) => JSON.stringify(x)),
        ],
      };
    },
  },
  'pressure-runs': {
    filename: 'pressure-engine-runs.csv',
    fetch: async (wid) => {
      const rows = await prisma.pressureEngineRun.findMany({
        where: { workspaceId: wid },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: [
          'id',
          'loadId',
          'rangeSessionId',
          'status',
          'pressurePredictionStatus',
          'velocityDeltaFps',
          'velocityDeltaPct',
          'acknowledgedExperimental',
          'notes',
          'createdAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.loadId,
          r.rangeSessionId,
          r.status,
          r.pressurePredictionStatus,
          r.velocityDeltaFps,
          r.velocityDeltaPct,
          r.acknowledgedExperimental,
          r.notes,
          date(r.createdAt),
        ]),
      };
    },
  },
  'validation-datasets': {
    filename: 'model-validation-datasets.csv',
    adminOnly: true,
    fetch: async (wid) => {
      const rows = await prisma.modelValidationDataset.findMany({
        where: { workspaceId: wid },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: [
          'id',
          'name',
          'kind',
          'status',
          'description',
          'referenceIdentifier',
          'licenseNote',
          'acknowledgedValidationOnly',
          'createdAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.name,
          r.kind,
          r.status,
          r.description,
          r.referenceIdentifier,
          r.licenseNote,
          r.acknowledgedValidationOnly,
          date(r.createdAt),
        ]),
      };
    },
  },
  'validation-cases': {
    filename: 'model-validation-cases.csv',
    adminOnly: true,
    fetch: async (wid) => {
      const rows = await prisma.modelValidationCase.findMany({
        where: { workspaceId: wid },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: [
          'id',
          'datasetId',
          'label',
          'cartridgeName',
          'bulletWeightGr',
          'bulletDiameterIn',
          'chargeGr',
          'caseCapacityGrH2O',
          'barrelLengthIn',
          'twistRate',
          'cartridgeOalIn',
          'powderBurnRateLabel',
          'tempF',
          'referenceVelocityFps',
          'referencePressurePsi',
          'observedVelocityFps',
          'pageLabel',
          'notes',
          'createdAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.datasetId,
          r.label,
          r.cartridgeName,
          r.bulletWeightGr,
          r.bulletDiameterIn,
          r.chargeGr,
          r.caseCapacityGrH2O,
          r.barrelLengthIn,
          r.twistRate,
          r.cartridgeOalIn,
          r.powderBurnRateLabel,
          r.tempF,
          r.referenceVelocityFps,
          r.referencePressurePsi,
          r.observedVelocityFps,
          r.pageLabel,
          r.notes,
          date(r.createdAt),
        ]),
      };
    },
  },
  'validation-runs': {
    filename: 'model-validation-runs.csv',
    adminOnly: true,
    fetch: async (wid) => {
      const rows = await prisma.modelValidationRun.findMany({
        where: { workspaceId: wid },
        orderBy: { createdAt: 'desc' },
      });
      return {
        headers: [
          'id',
          'datasetId',
          'adapterName',
          'adapterVersion',
          'modelVersionId',
          'status',
          'pressurePredictionStatus',
          'acknowledgedValidationOnly',
          'notes',
          'createdAt',
        ],
        rows: rows.map((r) => [
          r.id,
          r.datasetId,
          r.adapterName,
          r.adapterVersion,
          r.modelVersionId,
          r.status,
          r.pressurePredictionStatus,
          r.acknowledgedValidationOnly,
          r.notes,
          date(r.createdAt),
        ]),
      };
    },
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;
  const def = ENTITIES[entity];
  if (!def) {
    return new Response(`Unknown entity: ${entity}`, { status: 404 });
  }

  if (def.adminOnly) {
    const admin = await getAdminContext();
    if (!admin.isAdmin) {
      return new Response('Forbidden — admin-only export.', { status: 403 });
    }
  }

  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    return csvUnavailable(
      e instanceof Error ? e.message : 'Workspace context unavailable.',
    );
  }

  try {
    const { headers, rows } = await def.fetch(ctx.workspaceId);
    return csvResponse(def.filename, headers, rows);
  } catch (e) {
    return csvUnavailable(
      e instanceof Error ? e.message : 'CSV export failed.',
    );
  }
}
