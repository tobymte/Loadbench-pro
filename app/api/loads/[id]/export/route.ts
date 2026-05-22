import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getWorkspaceContext();
  const row = await prisma.load.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: {
      cartridge: true,
      bullet: true,
      powder: true,
      primer: true,
      case_: true,
      rifle: true,
      source: true,
      sessions: true,
    },
  });
  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  // TODO(audit): record AuditEvent action='export' for this load.
  return new NextResponse(JSON.stringify(row, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="load-${row.id}.json"`,
    },
  });
}
