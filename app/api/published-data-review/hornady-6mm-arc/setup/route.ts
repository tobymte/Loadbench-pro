import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
} from '@/lib/auth/workspace';
import {
  HORNADY_6MM_ARC_BULLETS,
  HORNADY_6MM_ARC_CARTRIDGE_NAME,
  HORNADY_6MM_ARC_CASE,
  HORNADY_6MM_ARC_GAS_GUN_CARTRIDGE,
  HORNADY_6MM_ARC_GAS_GUN_SOURCE,
  HORNADY_6MM_ARC_POWDERS,
  HORNADY_6MM_ARC_PRIMER,
  HORNADY_6MM_ARC_TEST_RIFLE,
} from '@/lib/data/hornady6mmArcGasGun';

export const dynamic = 'force-dynamic';

// POST /api/published-data-review/hornady-6mm-arc/setup
// Creates a non-authoritative review/staging set for the Hornady 6mm ARC Gas
// Gun data sheet. This endpoint only seeds METADATA (source citation,
// cartridge identity, test rifle, bullets, case, primer, and powder names).
// It DOES NOT insert any powder-charge rows. Users must transcribe and
// verify those themselves on the review page.
export async function POST() {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Source
    const source = await (async () => {
      const existing = await tx.source.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          title: HORNADY_6MM_ARC_GAS_GUN_SOURCE.title,
        },
      });
      if (existing) return existing;
      return tx.source.create({
        data: {
          workspaceId: ctx.workspaceId,
          title: HORNADY_6MM_ARC_GAS_GUN_SOURCE.title,
          publisher: HORNADY_6MM_ARC_GAS_GUN_SOURCE.publisher,
          edition: HORNADY_6MM_ARC_GAS_GUN_SOURCE.edition,
          citation: HORNADY_6MM_ARC_GAS_GUN_SOURCE.citation,
          notes: HORNADY_6MM_ARC_GAS_GUN_SOURCE.notes,
        },
      });
    })();

    // 2. Cartridge
    const cartridge = await tx.cartridge.upsert({
      where: {
        workspaceId_name: {
          workspaceId: ctx.workspaceId,
          name: HORNADY_6MM_ARC_CARTRIDGE_NAME,
        },
      },
      update: {
        bulletDiameterIn: HORNADY_6MM_ARC_GAS_GUN_CARTRIDGE.bulletDiameterIn,
        maxPressurePsi: HORNADY_6MM_ARC_GAS_GUN_CARTRIDGE.maxPressurePsi,
        notes: HORNADY_6MM_ARC_GAS_GUN_CARTRIDGE.notes,
      },
      create: {
        workspaceId: ctx.workspaceId,
        name: HORNADY_6MM_ARC_CARTRIDGE_NAME,
        bulletDiameterIn: HORNADY_6MM_ARC_GAS_GUN_CARTRIDGE.bulletDiameterIn,
        maxPressurePsi: HORNADY_6MM_ARC_GAS_GUN_CARTRIDGE.maxPressurePsi,
        notes: HORNADY_6MM_ARC_GAS_GUN_CARTRIDGE.notes,
      },
    });

    // 3. Rifle
    const rifle = await (async () => {
      const existing = await tx.rifle.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          name: HORNADY_6MM_ARC_TEST_RIFLE.name,
        },
      });
      if (existing) return existing;
      return tx.rifle.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: HORNADY_6MM_ARC_TEST_RIFLE.name,
          manufacturer: HORNADY_6MM_ARC_TEST_RIFLE.manufacturer,
          model: HORNADY_6MM_ARC_TEST_RIFLE.model,
          cartridgeId: cartridge.id,
          barrelLengthIn: HORNADY_6MM_ARC_TEST_RIFLE.barrelLengthIn,
          twistRate: HORNADY_6MM_ARC_TEST_RIFLE.twistRate,
          notes: HORNADY_6MM_ARC_TEST_RIFLE.notes,
        },
      });
    })();

    // 4. Components: bullets
    const bullets: { id: string }[] = [];
    for (const b of HORNADY_6MM_ARC_BULLETS) {
      const existing = await tx.component.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          kind: 'BULLET',
          manufacturer: b.manufacturer,
          model: b.model,
        },
      });
      if (existing) {
        bullets.push({ id: existing.id });
        continue;
      }
      const created = await tx.component.create({
        data: {
          workspaceId: ctx.workspaceId,
          kind: 'BULLET',
          manufacturer: b.manufacturer,
          model: b.model,
          bulletWeightGr: b.bulletWeightGr,
          bulletBc: b.bulletBc,
          notes: [
            `Hornady item #${b.itemNumber}.`,
            `COL ${b.colIn}" per Hornady 6mm ARC Gas Gun data sheet.`,
            b.bcG7 != null ? `G7 BC ${b.bcG7}.` : null,
          ]
            .filter(Boolean)
            .join(' '),
        },
      });
      bullets.push({ id: created.id });
    }

    // 5. Components: powders (names only, no charge data)
    const powders: { id: string }[] = [];
    for (const p of HORNADY_6MM_ARC_POWDERS) {
      const existing = await tx.component.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          kind: 'POWDER',
          manufacturer: p.manufacturer,
          model: p.model,
        },
      });
      if (existing) {
        powders.push({ id: existing.id });
        continue;
      }
      const created = await tx.component.create({
        data: {
          workspaceId: ctx.workspaceId,
          kind: 'POWDER',
          manufacturer: p.manufacturer,
          model: p.model,
          burnRateLabel: p.model,
          notes:
            'Listed as a powder option in the Hornady 6mm ARC Gas Gun data sheet. No charge data is seeded; transcribe and verify charges yourself.',
        },
      });
      powders.push({ id: created.id });
    }

    // 6. Components: case
    const caseExisting = await tx.component.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        kind: 'CASE',
        manufacturer: HORNADY_6MM_ARC_CASE.manufacturer,
        model: HORNADY_6MM_ARC_CASE.model,
      },
    });
    if (!caseExisting) {
      await tx.component.create({
        data: {
          workspaceId: ctx.workspaceId,
          kind: 'CASE',
          manufacturer: HORNADY_6MM_ARC_CASE.manufacturer,
          model: HORNADY_6MM_ARC_CASE.model,
          notes: HORNADY_6MM_ARC_CASE.notes,
        },
      });
    }

    // 7. Components: primer
    const primerExisting = await tx.component.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        kind: 'PRIMER',
        manufacturer: HORNADY_6MM_ARC_PRIMER.manufacturer,
        model: HORNADY_6MM_ARC_PRIMER.model,
      },
    });
    if (!primerExisting) {
      await tx.component.create({
        data: {
          workspaceId: ctx.workspaceId,
          kind: 'PRIMER',
          manufacturer: HORNADY_6MM_ARC_PRIMER.manufacturer,
          model: HORNADY_6MM_ARC_PRIMER.model,
          notes: HORNADY_6MM_ARC_PRIMER.notes,
        },
      });
    }

    // 8. Review import record (intentionally empty of charge rows)
    const importRecord = await (async () => {
      const existing = await tx.publishedDataImport.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          title: HORNADY_6MM_ARC_GAS_GUN_SOURCE.title,
        },
      });
      if (existing) return existing;
      return tx.publishedDataImport.create({
        data: {
          workspaceId: ctx.workspaceId,
          sourceId: source.id,
          title: HORNADY_6MM_ARC_GAS_GUN_SOURCE.title,
          publisher: HORNADY_6MM_ARC_GAS_GUN_SOURCE.publisher,
          reference: HORNADY_6MM_ARC_GAS_GUN_SOURCE.citation,
          notes:
            'Review/staging container for the Hornady 6mm ARC Gas Gun data sheet. Metadata seeded automatically; charge rows must be entered and verified by a workspace member.',
          status: 'IN_REVIEW',
          createdById: ctx.userId,
        },
      });
    })();

    return {
      sourceId: source.id,
      cartridgeId: cartridge.id,
      rifleId: rifle.id,
      bulletCount: bullets.length,
      powderCount: powders.length,
      importId: importRecord.id,
    };
  });

  return NextResponse.json(
    {
      ...result,
      warning:
        'Metadata only. No powder-charge rows were created. Charges must be transcribed and verified against the original source before any downstream use.',
    },
    { status: 201 },
  );
}
