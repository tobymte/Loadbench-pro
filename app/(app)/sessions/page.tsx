import { Topbar } from '@/components/layout/Topbar';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SessionForm } from '@/components/forms/SessionForm';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const ctx = await getWorkspaceContext();

  const [sessions, loads, rifles] = await Promise.all([
    prisma.rangeSession.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { date: 'desc' },
      include: {
        load: { select: { id: true, name: true } },
        rifle: { select: { id: true, name: true } },
      },
    }),
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
      <Topbar title="Range sessions" />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <SessionForm
          options={{
            loads: loads.map((l) => ({ value: l.id, label: l.name })),
            rifles: rifles.map((r) => ({ value: r.id, label: r.name })),
          }}
        />

        <Card>
          <CardHeader
            title="Range sessions"
            description="Recorded sessions sorted by date. Group size and chronograph data are optional observations only."
          />
          {sessions.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No sessions logged"
                description="Log a session above to track velocity, group size, and conditions."
              />
            </div>
          ) : (
            <table data-testid="sessions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Load</th>
                  <th>Rifle</th>
                  <th>Location</th>
                  <th className="text-right">Temp °F</th>
                  <th className="text-right">Wind</th>
                  <th className="text-right">Shots</th>
                  <th className="text-right">Avg vel</th>
                  <th className="text-right">ES</th>
                  <th className="text-right">SD</th>
                  <th className="text-right">Group (in)</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="text-text-muted">
                      {new Date(s.date).toLocaleDateString()}
                    </td>
                    <td className="text-text-muted">{s.load?.name ?? '—'}</td>
                    <td className="text-text-muted">{s.rifle?.name ?? '—'}</td>
                    <td className="text-text-muted">{s.location ?? '—'}</td>
                    <td className="text-right tabular-nums">{s.tempF ?? '—'}</td>
                    <td className="text-right tabular-nums">{s.windMph ?? '—'}</td>
                    <td className="text-right tabular-nums">{s.shotsFired ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      {s.avgVelocityFps ?? '—'}
                    </td>
                    <td className="text-right tabular-nums">{s.esFps ?? '—'}</td>
                    <td className="text-right tabular-nums">{s.sdFps ?? '—'}</td>
                    <td className="text-right tabular-nums">{s.groupSizeIn ?? '—'}</td>
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
