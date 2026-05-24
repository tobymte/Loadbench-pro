import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function LoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getWorkspaceContext();
  const load = await prisma.load.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      cartridge: { select: { name: true } },
      bullet: true,
      powder: true,
      primer: true,
      case_: true,
      rifle: { select: { id: true, name: true } },
      source: {
        select: { id: true, title: true, citation: true, publishedMaxGr: true },
      },
      sessions: {
        orderBy: { date: 'desc' },
        select: {
          id: true,
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
  });

  if (!load) {
    notFound();
  }

  const tone =
    load.status === 'TESTED'
      ? 'success'
      : load.status === 'LOADED'
        ? 'accent'
        : 'neutral';

  return (
    <>
      <Topbar
        title={load.name}
        actions={
          <>
            <Link href={`/api/loads/${load.id}/export`}>
              <Button size="sm" variant="secondary">
                Export JSON
              </Button>
            </Link>
            <Link href="/notebook">
              <Button size="sm" variant="secondary">
                Print card
              </Button>
            </Link>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Load details"
            description="The complete record for this load."
            actions={<Badge tone={tone}>{load.status}</Badge>}
          />
          <CardBody>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <Detail label="Cartridge" value={load.cartridge?.name ?? '—'} />
              <Detail
                label="Bullet"
                value={
                  load.bullet
                    ? `${load.bullet.manufacturer} ${load.bullet.model}${load.bullet.bulletWeightGr ? ` ${load.bullet.bulletWeightGr}gr` : ''}`
                    : '—'
                }
              />
              <Detail
                label="Powder"
                value={
                  load.powder
                    ? `${load.powder.manufacturer} ${load.powder.model}`
                    : '—'
                }
              />
              <Detail
                label="Primer"
                value={
                  load.primer
                    ? `${load.primer.manufacturer} ${load.primer.model}`
                    : '—'
                }
              />
              <Detail
                label="Case"
                value={
                  load.case_
                    ? `${load.case_.manufacturer} ${load.case_.model}`
                    : '—'
                }
              />
              <Detail
                label="Charge (gr)"
                value={load.chargeGr != null ? String(load.chargeGr) : '—'}
                mono
              />
              <Detail
                label="OAL (in)"
                value={load.cartridgeOalIn != null ? String(load.cartridgeOalIn) : '—'}
                mono
              />
              <Detail
                label="Base→ogive (in)"
                value={
                  load.cartridgeBaseToOgiveIn != null
                    ? String(load.cartridgeBaseToOgiveIn)
                    : '—'
                }
                mono
              />
              <Detail
                label="Case trim (in)"
                value={
                  load.caseTrimLengthIn != null
                    ? String(load.caseTrimLengthIn)
                    : '—'
                }
                mono
              />
              <Detail
                label="Neck tension (thou)"
                value={
                  load.neckTensionThou != null
                    ? String(load.neckTensionThou)
                    : '—'
                }
                mono
              />
              <Detail label="Source" value={load.source?.title ?? '—'} />
              <Detail
                label="Source page"
                value={load.sourcePageLabel ?? '—'}
              />
              <Detail
                label="Published max (source, gr)"
                value={
                  load.source?.publishedMaxGr != null
                    ? String(load.source.publishedMaxGr)
                    : '—'
                }
                mono
                testid="load-detail-source-published-max"
              />
              <Detail
                label="Published max (row, gr)"
                value={
                  load.publishedMaxChargeGr != null
                    ? String(load.publishedMaxChargeGr)
                    : '—'
                }
                mono
                testid="load-detail-row-published-max"
              />
              <Detail
                label="Safety acknowledged"
                value={load.safetyAcknowledged ? 'Yes' : 'No'}
              />
              <Detail label="Rifle" value={load.rifle?.name ?? '—'} />
            </dl>
            {load.safetyNotes && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-text-faint">
                  Safety notes
                </div>
                <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">
                  {load.safetyNotes}
                </p>
              </div>
            )}
            {load.notes && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-text-faint">
                  Notes
                </div>
                <p className="mt-1 text-sm text-text-muted whitespace-pre-wrap">
                  {load.notes}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Range sessions"
            description="Sessions where this load was shot."
          />
          <CardBody>
            {load.sessions.length === 0 ? (
              <p className="text-sm text-text-muted">
                No range sessions recorded against this load yet.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Location</th>
                    <th className="text-right">Shots</th>
                    <th className="text-right">Avg vel (fps)</th>
                    <th className="text-right">ES</th>
                    <th className="text-right">SD</th>
                    <th className="text-right">Group (in)</th>
                    <th className="text-right">Dist (yd)</th>
                  </tr>
                </thead>
                <tbody>
                  {load.sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="text-text-muted">
                        {new Date(s.date).toLocaleDateString()}
                      </td>
                      <td className="text-text-muted">{s.location ?? '—'}</td>
                      <td className="text-right tabular-nums">{s.shotsFired ?? '—'}</td>
                      <td className="text-right tabular-nums">
                        {s.avgVelocityFps ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">{s.esFps ?? '—'}</td>
                      <td className="text-right tabular-nums">{s.sdFps ?? '—'}</td>
                      <td className="text-right tabular-nums">
                        {s.groupSizeIn ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {s.groupDistanceYd ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              LoadBench Pro records the data you enter and the source you cite.
              It does not certify load safety or recommend charge weights.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Detail({
  label,
  value,
  mono,
  testid,
}: {
  label: string;
  value: string;
  mono?: boolean;
  testid?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-text-faint">
        {label}
      </dt>
      <dd
        className={
          'mt-1 text-text ' + (mono ? 'font-mono tabular-nums' : 'font-medium')
        }
        data-testid={testid}
      >
        {value}
      </dd>
    </div>
  );
}
