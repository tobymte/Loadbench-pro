// Loads optional ballistics prefills from saved Loads. The external
// ballistics calculator must work without a database or workspace context,
// so this helper isolates the Prisma/workspace dependency and degrades
// gracefully when DATABASE_URL is missing, when the user is unauthenticated,
// or when any database call fails.

export type BallisticsPrefill = {
  id: string;
  label: string;
  bulletWeightGr: number | null;
  bcG1: number | null;
  muzzleVelocityFps: number | null;
  zeroDistanceYd: number | null;
};

export type BallisticsPrefillResult = {
  prefills: BallisticsPrefill[];
  prefillsAvailable: boolean;
  prefillError: 'no-database' | 'unauthenticated' | 'lookup-failed' | null;
};

export async function loadBallisticsPrefills(): Promise<BallisticsPrefillResult> {
  if (!process.env.DATABASE_URL) {
    return { prefills: [], prefillsAvailable: false, prefillError: 'no-database' };
  }

  try {
    const { getWorkspaceContext } = await import('@/lib/auth/workspace');
    const { prisma } = await import('@/lib/db/prisma');

    let ctx;
    try {
      ctx = await getWorkspaceContext();
    } catch {
      return {
        prefills: [],
        prefillsAvailable: false,
        prefillError: 'unauthenticated',
      };
    }

    const loads = await prisma.load.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        bullet: {
          select: {
            manufacturer: true,
            model: true,
            bulletWeightGr: true,
            bulletBc: true,
          },
        },
        rifle: { select: { zeroDistanceYd: true } },
        sessions: {
          select: { date: true, avgVelocityFps: true },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    const prefills: BallisticsPrefill[] = loads.map((l) => ({
      id: l.id,
      label: l.bullet
        ? `${l.name} — ${l.bullet.manufacturer} ${l.bullet.model}`
        : l.name,
      bulletWeightGr: l.bullet?.bulletWeightGr ?? null,
      bcG1: l.bullet?.bulletBc ?? null,
      muzzleVelocityFps: l.sessions[0]?.avgVelocityFps ?? null,
      zeroDistanceYd: l.rifle?.zeroDistanceYd ?? null,
    }));

    return { prefills, prefillsAvailable: true, prefillError: null };
  } catch {
    return {
      prefills: [],
      prefillsAvailable: false,
      prefillError: 'lookup-failed',
    };
  }
}
