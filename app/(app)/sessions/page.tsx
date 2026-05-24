import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { SessionForm } from '@/components/forms/SessionForm';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { summarizeSessionsByLoad } from '@/lib/analysis/sessions';

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

  const analysis = summarizeSessionsByLoad(sessions);

  return (
    <>
      <Topbar
        title="Range sessions"
        actions={
          <Link href="/chrono-import">
            <Button size="sm" variant="secondary">
              Import chrono CSV
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <SessionForm
          options={{
            loads: loads.map((l) => ({ value: l.id, label: l.name })),
            rifles: rifles.map((r) => ({ value: r.id, label: r.name })),
          }}
        />

        <Card>
          <CardHeader
            title="Per-load analysis"
            description="Observed data only. Summaries computed from sessions you have logged — LoadBench Pro does not predict velocity, pressure, or charge."
          />
          <CardBody>
            {analysis.length === 0 ? (
              <p className="text-sm text-text-muted">
                No per-load summaries yet. Link sessions to a load using the{' '}
                <strong className="text-text">Load</strong> field on each
                session, and summaries will appear here.
              </p>
            ) : (
              <table data-testid="analysis-table">
                <thead>
                  <tr>
                    <th>Load</th>
                    <th>Rifle</th>
                    <th className="text-right">Sessions</th>
                    <th className="text-right">Latest avg vel</th>
                    <th className="text-right">Best group (in)</th>
                    <th className="text-right">Avg SD</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.map((row) => (
                    <tr key={row.loadId}>
                      <td className="font-medium">{row.loadName}</td>
                      <td className="text-text-muted">
                        {row.rifleName ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">{row.count}</td>
                      <td className="text-right tabular-nums">
                        {row.latestAvgVelocityFps ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {row.bestGroupSizeIn ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {row.avgSdFps ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-[11px] text-text-faint">
              All values are observed and user-entered. Nothing here is a
              predicted velocity, predicted pressure, or charge recommendation.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Range sessions"
            description="Recorded sessions sorted by date. Group size and chronograph data are optional observations only."
          />
          {sessions.length === 0 ? (
            <div className="p-5">
              <EmptyState
                tone="accent"
                title="No sessions logged"
                description="Log a session above to track velocity, group size, and conditions. Have a chronograph CSV? Import a whole string at once."
                testid="sessions-empty"
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
                  <th className="text-right">Dist (yd)</th>
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
                    <td className="text-right tabular-nums">
                      {s.groupDistanceYd ?? '—'}
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
