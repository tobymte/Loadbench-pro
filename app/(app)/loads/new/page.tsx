import { Topbar } from '@/components/layout/Topbar';
import { LoadForm, LoadFormOption, LoadFormOptions } from '@/components/forms/LoadForm';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

function componentLabel(c: {
  manufacturer: string;
  model: string;
  bulletWeightGr: number | null;
  lotNumber: string | null;
}) {
  const weight = c.bulletWeightGr ? ` ${c.bulletWeightGr}gr` : '';
  const lot = c.lotNumber ? ` · lot ${c.lotNumber}` : '';
  return `${c.manufacturer} ${c.model}${weight}${lot}`;
}

export default async function NewLoadPage() {
  const ctx = await getWorkspaceContext();
  const [cartridges, components, rifles, sources] = await Promise.all([
    prisma.cartridge.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
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
        lotNumber: true,
      },
    }),
    prisma.rifle.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.source.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, publishedMaxGr: true },
    }),
  ]);

  const byKind = (kind: 'BULLET' | 'POWDER' | 'PRIMER' | 'CASE'): LoadFormOption[] =>
    components
      .filter((c) => c.kind === kind)
      .map((c) => ({ value: c.id, label: componentLabel(c) }));

  const options: LoadFormOptions = {
    cartridges: cartridges.map((c) => ({ value: c.id, label: c.name })),
    bullets: byKind('BULLET'),
    powders: byKind('POWDER'),
    primers: byKind('PRIMER'),
    cases: byKind('CASE'),
    rifles: rifles.map((r) => ({ value: r.id, label: r.name })),
    sources: sources.map((s) => ({
      value: s.id,
      label: s.publishedMaxGr
        ? `${s.title} (max ${s.publishedMaxGr} gr)`
        : s.title,
    })),
  };

  return (
    <>
      <Topbar title="New load" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="max-w-4xl mx-auto">
          <LoadForm options={options} />
        </div>
      </div>
    </>
  );
}
