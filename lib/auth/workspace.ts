import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/prisma';

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  if (process.env.LOADBENCH_DISABLE_AUTH === 'true') {
    return {
      userId: 'dev-user',
      workspaceId: 'dev-workspace',
      role: 'OWNER',
    };
  }

  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new Error('UNAUTHENTICATED');
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    `${clerkUserId}@loadbench.local`;
  const displayName =
    clerkUser?.fullName ??
    clerkUser?.username ??
    email;

  const user = await prisma.user.upsert({
    where: { clerkUserId },
    update: {
      email,
      displayName,
    },
    create: {
      clerkUserId,
      email,
      displayName,
    },
  });

  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  if (existingMembership) {
    return {
      userId: user.id,
      workspaceId: existingMembership.workspaceId,
      role: existingMembership.role,
    };
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const createdWorkspace = await tx.workspace.create({
      data: {
        name: `${displayName}'s LoadBench`,
        slug: `workspace-${user.id}`,
        ownerId: user.id,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: createdWorkspace.id,
        userId: user.id,
        role: 'OWNER',
      },
    });

    return createdWorkspace;
  });

  return {
    userId: user.id,
    workspaceId: workspace.id,
    role: 'OWNER',
  };
}

export function assertCanWrite(ctx: WorkspaceContext) {
  if (ctx.role === 'VIEWER') {
    throw new Error('FORBIDDEN: viewer cannot mutate.');
  }
}

export function scopeToWorkspace<T extends Record<string, unknown>>(
  ctx: WorkspaceContext,
  where: T = {} as T,
): T & { workspaceId: string } {
  return { ...where, workspaceId: ctx.workspaceId };
}
