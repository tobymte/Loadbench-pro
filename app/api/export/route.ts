import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext, scopeToWorkspace } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getWorkspaceContext();
  const where = scopeToWorkspace(ctx);
  const [cartridges, components, rifles, sources, loads, sessions] =
    await Promise.all([
      prisma.cartridge.findMany({ where }),
      prisma.component.findMany({ where }),
      prisma.rifle.findMany({ where }),
      prisma.source.findMany({ where }),
      prisma.load.findMany({ where }),
      prisma.rangeSession.findMany({ where }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    workspaceId: ctx.workspaceId,
    cartridges,
    components,
    rifles,
    sources,
    loads,
    sessions,
  };

  // TODO(audit): record AuditEvent for the workspace export.
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="loadbench-${ctx.workspaceId}.json"`,
    },
  });
}
