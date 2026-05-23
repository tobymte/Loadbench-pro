import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  getWorkspaceContext,
  scopeToWorkspace,
} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

// GET /api/published-data-review/imports
// Returns review/staging imports for the workspace. Imports are NOT
// authoritative loads.
export async function GET() {
  const ctx = await getWorkspaceContext();
  const rows = await prisma.publishedDataImport.findMany({
    where: scopeToWorkspace(ctx),
    orderBy: { updatedAt: 'desc' },
    include: {
      source: { select: { id: true, title: true } },
      _count: { select: { rows: true } },
    },
  });
  return NextResponse.json({ data: rows });
}
