/**
 * Workspace access helpers.
 *
 * These are STUBS to be wired up to Clerk + the database once auth is fully
 * configured. The shape is intentionally minimal so route handlers can be
 * written against it today and the implementation can be swapped without
 * touching call sites.
 *
 * TODO(auth): replace stubbed values with real Clerk `auth()` + Prisma lookup
 *   of WorkspaceMember to enforce role/permission boundaries.
 */

import { prisma } from '@/lib/db/prisma';

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};

/**
 * Resolve the current workspace context for a request.
 *
 * In the scaffold this returns a deterministic dev context so the UI renders
 * without auth configured. Replace with the real implementation below.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  if (process.env.LOADBENCH_DISABLE_AUTH === 'true') {
    return {
      userId: 'dev-user',
      workspaceId: 'dev-workspace',
      role: 'OWNER',
    };
  }

  // TODO(auth): wire to Clerk
  // const { userId } = auth();
  // if (!userId) throw new Error('UNAUTHENTICATED');
  // const membership = await prisma.workspaceMember.findFirstOrThrow({
  //   where: { user: { clerkUserId: userId } },
  //   orderBy: { createdAt: 'asc' },
  // });
  // return { userId: membership.userId, workspaceId: membership.workspaceId, role: membership.role };

  throw new Error('Workspace context resolution not configured.');
}

/**
 * Assert the caller can write to a workspace-scoped entity. Stub-only.
 */
export function assertCanWrite(ctx: WorkspaceContext) {
  if (ctx.role === 'VIEWER') {
    throw new Error('FORBIDDEN: viewer cannot mutate.');
  }
}

/**
 * Scope a Prisma where-clause to a workspace. Use on every query touching
 * workspace-scoped tables.
 */
export function scopeToWorkspace<T extends Record<string, unknown>>(
  ctx: WorkspaceContext,
  where: T = {} as T,
): T & { workspaceId: string } {
  return { ...where, workspaceId: ctx.workspaceId };
}

// Suppress unused warning when prisma is not referenced in the stub path.
void prisma;
