import { Topbar } from '@/components/layout/Topbar';
import {
  Printables,
  PrintableComponent,
  PrintableLoad,
} from '@/components/notebook/Printables';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function NotebookPage() {
  const ctx = await getWorkspaceContext();

  const [loads, components] = await Promise.all([
    prisma.load.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        cartridge: { select: { name: true } },
        bullet: {
          select: {
            manufacturer: true,
            model: true,
            bulletWeightGr: true,
          },
        },
        powder: {
          select: { manufacturer: true, model: true, burnRateLabel: true },
        },
        primer: { select: { manufacturer: true, model: true } },
        case_: { select: { manufacturer: true, model: true } },
        rifle: {
          select: {
            name: true,
            barrelLengthIn: true,
            twistRate: true,
            opticNotes: true,
            zeroDistanceYd: true,
          },
        },
        source: {
          select: {
            title: true,
            publisher: true,
            edition: true,
            publishedYear: true,
            citation: true,
            publishedMaxGr: true,
          },
        },
        sessions: {
          orderBy: { date: 'desc' },
          select: {
            date: true,
            location: true,
            avgVelocityFps: true,
            esFps: true,
            sdFps: true,
            groupSizeIn: true,
            groupDistanceYd: true,
            shotsFired: true,
          },
        },
      },
    }),
    prisma.component.findMany({
      where: { workspaceId: ctx.workspaceId, archived: false },
      orderBy: [{ kind: 'asc' }, { manufacturer: 'asc' }, { model: 'asc' }],
      select: {
        id: true,
        kind: true,
        manufacturer: true,
        model: true,
        bulletWeightGr: true,
        bulletBc: true,
        burnRateLabel: true,
        lotNumber: true,
        notes: true,
      },
    }),
  ]);

  const printableLoads: PrintableLoad[] = loads.map((l) => {
    const sessions = l.sessions;
    const latest = sessions[0] ?? null;
    let bestGroup: number | null = null;
    let sdSum = 0;
    let sdCount = 0;
    for (const s of sessions) {
      if (s.groupSizeIn != null && (bestGroup == null || s.groupSizeIn < bestGroup)) {
        bestGroup = s.groupSizeIn;
      }
      if (s.sdFps != null) {
        sdSum += s.sdFps;
        sdCount += 1;
      }
    }
    return {
      id: l.id,
      name: l.name,
      status: l.status,
      chargeGr: l.chargeGr,
      cartridgeOalIn: l.cartridgeOalIn,
      cartridgeBaseToOgiveIn: l.cartridgeBaseToOgiveIn,
      caseTrimLengthIn: l.caseTrimLengthIn,
      neckTensionThou: l.neckTensionThou,
      safetyAcknowledged: l.safetyAcknowledged,
      safetyNotes: l.safetyNotes,
      notes: l.notes,
      cartridge: l.cartridge,
      bullet: l.bullet,
      powder: l.powder,
      primer: l.primer,
      case_: l.case_,
      rifle: l.rifle,
      source: l.source,
      latestSession: latest
        ? {
            ...latest,
            date: latest.date.toISOString(),
          }
        : null,
      chronoSummary:
        sessions.length > 0
          ? {
              sessionCount: sessions.length,
              latestAvgVelocityFps: latest?.avgVelocityFps ?? null,
              bestGroupSizeIn: bestGroup,
              avgSdFps:
                sdCount > 0 ? Math.round((sdSum / sdCount) * 10) / 10 : null,
            }
          : null,
    };
  });

  const printableComponents: PrintableComponent[] = components.map((c) => ({
    id: c.id,
    kind: c.kind,
    manufacturer: c.manufacturer,
    model: c.model,
    bulletWeightGr: c.bulletWeightGr,
    bulletBc: c.bulletBc,
    burnRateLabel: c.burnRateLabel,
    lotNumber: c.lotNumber,
    notes: c.notes,
  }));

  return (
    <>
      <Topbar title="Notebook" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <Printables loads={printableLoads} components={printableComponents} />
      </div>
    </>
  );
}
