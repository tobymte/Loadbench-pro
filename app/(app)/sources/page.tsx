import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SourceForm } from '@/components/forms/SourceForm';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.source.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { title: 'asc' },
    select: {
      id: true,
      title: true,
      publisher: true,
      edition: true,
      publishedYear: true,
      url: true,
      citation: true,
      publishedMaxGr: true,
    },
  });

  return (
    <>
      <Topbar title="Sources" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <SourceForm />

        <Card>
          <CardHeader
            title="Cited sources"
            description="Published references you cite when recording a load. Source values are user-entered citations only — LoadBench Pro does not certify load safety."
          />
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                tone="accent"
                title="No sources yet"
                description="Record the manuals and manufacturer data sheets you cite. A load with a charge weight must reference one of these — this is your audit trail back to the published reference."
                testid="sources-empty"
              />
            </div>
          ) : (
            <table data-testid="sources-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Publisher</th>
                  <th>Edition</th>
                  <th className="text-right">Year</th>
                  <th>Citation</th>
                  <th className="text-right">Published max (gr)</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.title}</td>
                    <td className="text-text-muted">{r.publisher ?? '—'}</td>
                    <td className="text-text-muted">{r.edition ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {r.publishedYear ?? '—'}
                    </td>
                    <td className="text-text-muted">{r.citation ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {r.publishedMaxGr ?? '—'}
                    </td>
                    <td className="text-text-muted">
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:text-accent-hover"
                        >
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
