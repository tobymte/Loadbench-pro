// Helpers for pages that want to query Prisma but should degrade gracefully
// when DATABASE_URL is missing, the user is unauthenticated, or any database
// error occurs (stale Prisma client, missing tables, transient outages, etc.).
//
// These helpers never throw and always return a typed error code instead, so
// route handlers and server components can render a friendly setup notice
// rather than crashing with PrismaClientInitializationError.

export type DataUnavailableReason =
  | 'no-database'
  | 'unauthenticated'
  | 'lookup-failed';

export type SafeLoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: DataUnavailableReason };

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function safeWithWorkspace<T>(
  fn: (ctx: {
    workspaceId: string;
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    prisma: typeof import('@/lib/db/prisma').prisma;
  }) => Promise<T>,
): Promise<SafeLoadResult<T>> {
  if (!isDatabaseConfigured()) {
    return { ok: false, reason: 'no-database' };
  }

  let getWorkspaceContext: typeof import('@/lib/auth/workspace').getWorkspaceContext;
  let prisma: typeof import('@/lib/db/prisma').prisma;
  try {
    ({ getWorkspaceContext } = await import('@/lib/auth/workspace'));
    ({ prisma } = await import('@/lib/db/prisma'));
  } catch {
    return { ok: false, reason: 'lookup-failed' };
  }

  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch {
    return { ok: false, reason: 'unauthenticated' };
  }

  try {
    const data = await fn({ ...ctx, prisma });
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'lookup-failed' };
  }
}

export function describeUnavailability(reason: DataUnavailableReason): string {
  switch (reason) {
    case 'no-database':
      return 'No database is configured (DATABASE_URL is not set).';
    case 'unauthenticated':
      return 'You are not signed in.';
    case 'lookup-failed':
      return 'The database could not be reached right now.';
  }
}
