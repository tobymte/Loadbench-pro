import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { ChronoImportForm } from './ChronoImportForm';

export const dynamic = 'force-dynamic';

export default async function ChronoImportPage() {
  const ctx = await getWorkspaceContext();

  const [loads, rifles] = await Promise.all([
    prisma.load.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.rifle.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <Topbar title="Chronograph import" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Import chronograph data"
            description="Paste CSV from your chronograph and import it as a range session. LoadBench Pro records what you measured — it does not interpret your data and does not certify safety."
          />
          <CardBody>
            <div className="mb-4 rounded-md border border-border bg-bg-alt/40 px-4 py-3 text-[12px] text-text-muted">
              <div className="font-medium text-text mb-1">Expected format</div>
              <p>
                A simple CSV with one shot per row. The first row may be a
                header. The importer recognises <code>shot</code>,{' '}
                <code>velocity</code>, <code>velocity (fps)</code>,{' '}
                <code>fps</code>, and <code>note</code> column headers (case
                insensitive). If there&apos;s no header, the importer treats
                column 1 as shot number and column 2 as velocity, or — for a
                single-column file — every row as a velocity.
              </p>
              <pre className="mt-2 text-[11px] text-text-faint overflow-x-auto">
{`shot,velocityFps,note
1,2735,
2,2742,foul shot
3,2738,`}
              </pre>
            </div>
            <ChronoImportForm
              loads={loads.map((l) => ({ value: l.id, label: l.name }))}
              rifles={rifles.map((r) => ({ value: r.id, label: r.name }))}
            />
            <p className="mt-4 text-[11px] text-text-faint">
              Imported shots are aggregated into a single range session
              (average velocity, ES, SD, shots fired). Individual shots are
              referenced in the session notes for traceability. No safety,
              pressure, or charge validation is performed on imported data.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
