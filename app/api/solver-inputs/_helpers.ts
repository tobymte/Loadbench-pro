import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type FkCheck = {
  field: string;
  id: string | null | undefined;
  table:
    | 'cartridge'
    | 'load'
    | 'component'
    | 'rifle'
    | 'source';
};

/**
 * Validate that referenced entity ids exist in the given workspace. Returns
 * a 400 NextResponse if any are missing, otherwise null. Skips checks where
 * id is null/undefined/empty.
 */
export async function assertReferencesInWorkspace(
  workspaceId: string,
  checks: FkCheck[],
): Promise<NextResponse | null> {
  for (const c of checks) {
    if (!c.id) continue;
    const exists = await (async () => {
      switch (c.table) {
        case 'cartridge':
          return prisma.cartridge.findFirst({
            where: { id: c.id!, workspaceId },
            select: { id: true },
          });
        case 'load':
          return prisma.load.findFirst({
            where: { id: c.id!, workspaceId },
            select: { id: true },
          });
        case 'component':
          return prisma.component.findFirst({
            where: { id: c.id!, workspaceId },
            select: { id: true },
          });
        case 'rifle':
          return prisma.rifle.findFirst({
            where: { id: c.id!, workspaceId },
            select: { id: true },
          });
        case 'source':
          return prisma.source.findFirst({
            where: { id: c.id!, workspaceId },
            select: { id: true },
          });
      }
    })();
    if (!exists) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: [c.field],
              code: 'INVALID_SHAPE',
              message: `Referenced ${c.table} not found in this workspace.`,
            },
          ],
        },
        { status: 400 },
      );
    }
  }
  return null;
}
