import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { describeUnavailability, safeWithWorkspace } from '@/lib/db/safeLoad';
import { ChronoImportForm } from './ChronoImportForm';

export const dynamic = 'force-dynamic';

export default async function ChronoImportPage() {
  const result = await safeWithWorkspace(async ({ workspaceId, prisma }) => {
    const [loads, rifles] = await Promise.all([
      prisma.load.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true },
      }),
      prisma.rifle.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);
    return { loads, rifles };
  });

  const saveAvailable = result.ok;
  const loads = result.ok ? result.data.loads : [];
  const rifles = result.ok ? result.data.rifles : [];
  const unavailableReason = result.ok ? null : result.reason;

  return (
    <>
      <Topbar title="Chronograph import" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Import chronograph data"
            description="Paste CSV from your chronograph and import it as a range session. LoadBench Pro records what you measured — it does not interpret your data and does not certify safety."
          />
          <CardBody>
            <div className="mb-4 rounded-md border border-border bg-bg-alt/40 px-4 py-3 text-[12px] text-text-muted">
              <div className="font-medium text-text mb-1">
                Choose a template or upload a CSV/TXT/TSV file
              </div>
              <p>
                The importer recognises Garmin Xero, LabRadar, MagnetoSpeed,
                and Caldwell exports out of the box. It also detects tab and
                semicolon delimiters, picks up m/s columns and converts them
                to fps, and warns on suspicious velocities or duplicate shot
                numbers. Files are parsed in your browser — nothing is
                uploaded until you press Import.
              </p>
            </div>

            {!saveAvailable && unavailableReason && (
              <div
                className="mb-4 rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[12px] text-text"
                data-testid="chrono-import-unavailable"
              >
                <div className="font-medium text-warning mb-1">
                  Saving is disabled — database not available.
                </div>
                <p className="text-text-muted">
                  {describeUnavailability(unavailableReason)} You can still
                  paste a CSV below and preview the parsed shots and computed
                  summary (count, average velocity, ES, SD, min, max). Linking
                  to a saved load and persisting a range session requires a
                  database.
                </p>
                {unavailableReason === 'no-database' && (
                  <pre className="mt-2 text-[11px] bg-bg-alt/60 p-2 rounded overflow-x-auto">
{`# in .env.local
DATABASE_URL=postgresql://user:password@localhost:5432/loadbench

# then run migrations and restart the dev server
npx prisma migrate deploy
npm run dev`}
                  </pre>
                )}
                <p className="mt-2 text-text-muted">
                  No safety, pressure, or charge validation is performed on
                  imported or previewed data.
                </p>
              </div>
            )}

            <ChronoImportForm
              loads={loads.map((l) => ({ value: l.id, label: l.name }))}
              rifles={rifles.map((r) => ({ value: r.id, label: r.name }))}
              saveAvailable={saveAvailable}
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
