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
        rifle: { select: { name: true } },
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
          take: 1,
          select: {
            date: true,
            location: true,
            avgVelocityFps: true,
            esFps: true,
            sdFps: true,
            groupSizeIn: true,
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

  const printableLoads: PrintableLoad[] = loads.map((l) => ({
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
    latestSession: l.sessions[0]
      ? {
          ...l.sessions[0],
          date: l.sessions[0].date.toISOString(),
        }
      : null,
  }));

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
