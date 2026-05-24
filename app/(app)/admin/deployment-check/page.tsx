import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getAdminContext } from '@/lib/auth/admin';
import { collectChecks, summarize, type CheckStatus } from '@/lib/deployment/check';
import { prisma } from '@/lib/db/prisma';

// /admin/deployment-check
//
// Admin-only diagnostics page. Reports the presence (NOT the contents) of every
// environment variable the app cares about, plus a DB connectivity probe and a
// ballistics-engine /health probe. Never returns secret values — only flags
// whether a variable is set and reports lengths where useful.

export const dynamic = 'force-dynamic';

const tones: Record<CheckStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  warn: 'warning',
  missing: 'danger',
  info: 'neutral',
};

async function probeDb(): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, detail: 'DATABASE_URL is unset — skipped probe.' };
  }
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return { ok: true, detail: 'SELECT 1 returned successfully.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, detail: msg.slice(0, 200) };
  }
}

async function probeBallistics(): Promise<{
  configured: boolean;
  ok: boolean;
  detail: string;
}> {
  const url = process.env.BALLISTICS_ENGINE_URL;
  if (!url) {
    return {
      configured: false,
      ok: false,
      detail: 'BALLISTICS_ENGINE_URL unset. /ballistics renders setup help.',
    };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        detail: `Engine returned HTTP ${res.status}.`,
      };
    }
    const j = (await res.json().catch(() => null)) as
      | { status?: string; engine?: string }
      | null;
    return {
      configured: true,
      ok: j?.status === 'ok',
      detail: j?.engine
        ? `engine=${j.engine} status=${j.status ?? 'unknown'}`
        : 'Engine responded but body was not JSON.',
    };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 200) : 'unreachable',
    };
  }
}

export default async function DeploymentCheckPage() {
  const admin = await getAdminContext();

  if (!admin.isAdmin) {
    return (
      <>
        <Topbar
          title="Deployment check"
          actions={<Badge tone="danger">Operator-only</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <Card>
            <CardHeader
              title="Operator-only"
              description="This page reports the deployment configuration of LoadBench Pro and is restricted to operators."
            />
            <CardBody>
              <p className="text-sm text-text-muted">
                {admin.reason ?? 'You are not authorized to view this page.'}
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const groups = collectChecks();
  const summary = summarize(groups);
  const [db, ballistics] = await Promise.all([probeDb(), probeBallistics()]);

  return (
    <>
      <Topbar
        title="Deployment check"
        actions={
          <>
            <Badge tone="success">{summary.ok} ok</Badge>
            {summary.warn > 0 && (
              <Badge tone="warning">{summary.warn} warn</Badge>
            )}
            {summary.missing > 0 && (
              <Badge tone="danger">{summary.missing} missing</Badge>
            )}
            <Badge tone="neutral">{summary.info} info</Badge>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="What this page does"
            description="Reports the presence — not the contents — of every environment variable LoadBench Pro reads, plus liveness probes for the database and the external ballistics engine. Secrets are never returned to the browser."
          />
          <CardBody>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Use this to sanity-check a Vercel deployment. If something is
              wrong, fix the matching variable in Vercel → Project → Settings →
              Environment Variables and redeploy. Pressure prediction remains
              disabled regardless of any setting on this page.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Live probes"
            description="Quick connectivity tests against the database and the .NET ballistics service."
          />
          <CardBody className="space-y-3">
            <ProbeRow
              label="Database (Prisma)"
              ok={db.ok}
              detail={db.detail}
            />
            <ProbeRow
              label="Ballistics engine /health"
              ok={ballistics.ok}
              detail={ballistics.detail}
              skipped={!ballistics.configured}
            />
          </CardBody>
        </Card>

        {groups.map((g) => (
          <Card key={g.group}>
            <CardHeader title={g.group} description={g.description} />
            <CardBody className="!p-0">
              <ul className="divide-y divide-border">
                {g.checks.map((c) => (
                  <li
                    key={c.key}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <code className="text-[12px] text-text">{c.label}</code>
                      <div className="text-[12px] text-text-muted">
                        {c.detail}
                      </div>
                      {c.fix && (
                        <div className="text-[11px] text-warning mt-1">
                          Fix: {c.fix}
                        </div>
                      )}
                    </div>
                    <Badge tone={tones[c.status]}>{c.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}

function ProbeRow({
  label,
  ok,
  detail,
  skipped,
}: {
  label: string;
  ok: boolean;
  detail: string;
  skipped?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-border bg-bg-alt/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text">{label}</div>
        <div className="text-[12px] text-text-muted">{detail}</div>
      </div>
      <Badge tone={skipped ? 'neutral' : ok ? 'success' : 'danger'}>
        {skipped ? 'skipped' : ok ? 'ok' : 'fail'}
      </Badge>
    </div>
  );
}
