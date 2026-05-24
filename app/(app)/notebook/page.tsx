import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import {
  Printables,
  PrintableComponent,
  PrintableLoad,
  PrintableSource,
} from '@/components/notebook/Printables';
import { describeUnavailability, safeWithWorkspace } from '@/lib/db/safeLoad';

export const dynamic = 'force-dynamic';

export default async function NotebookPage() {
  const result = await safeWithWorkspace(async ({ workspaceId, prisma }) => {
    const [loads, components, sources] = await Promise.all([
      prisma.load.findMany({
        where: { workspaceId },
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
        where: { workspaceId, archived: false },
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
          quantityOnHand: true,
        },
      }),
      prisma.source.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          publisher: true,
          edition: true,
          publishedYear: true,
          citation: true,
          url: true,
          publishedMaxGr: true,
        },
      }),
    ]);
    return { loads, components, sources };
  });

  if (!result.ok) {
    return (
      <>
        <Topbar title="Notebook & printables" />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <Card>
            <CardHeader
              title="Printables"
              description="Range cards, load labels, component labels, and source verification cards."
            />
            <CardBody>
              <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text">
                <div className="font-medium text-warning mb-1">
                  Printables are unavailable.
                </div>
                <p className="text-text-muted">
                  {describeUnavailability(result.reason)} Once the database is
                  configured, this page lists your loads, components, and
                  sources so you can select what to print.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const { loads, components, sources } = result.data;

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
    quantityOnHand: c.quantityOnHand,
  }));

  const printableSources: PrintableSource[] = sources.map((s) => ({
    id: s.id,
    title: s.title,
    publisher: s.publisher,
    edition: s.edition,
    publishedYear: s.publishedYear,
    citation: s.citation,
    url: s.url,
    publishedMaxGr: s.publishedMaxGr,
  }));

  return (
    <>
      <Topbar title="Notebook & printables" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <Printables
          loads={printableLoads}
          components={printableComponents}
          sources={printableSources}
        />
      </div>
    </>
  );
}
