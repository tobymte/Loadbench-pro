import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

const sourceInput = z.object({
  title: z.string().min(1).max(240),
  publisher: z.string().max(120).optional().nullable(),
  edition: z.string().max(60).optional().nullable(),
  publishedYear: z.number().int().min(1800).max(2200).optional().nullable(),
  url: z.string().url().max(2000).optional().nullable().or(z.literal('')),
  citation: z.string().max(500).optional().nullable(),
  publishedMaxGr: z.number().positive().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.source.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: [{ title: 'asc' }],
  });
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = sourceInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const row = await prisma.source.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: data.title,
      publisher: data.publisher ?? null,
      edition: data.edition ?? null,
      publishedYear: data.publishedYear ?? null,
      url: data.url && data.url !== '' ? data.url : null,
      citation: data.citation ?? null,
      publishedMaxGr: data.publishedMaxGr ?? null,
      notes: data.notes ?? null,
    },
  });
  // TODO(audit): write AuditEvent { entityType: 'Source', entityId, action: 'create' }
  return NextResponse.json(row, { status: 201 });
}
