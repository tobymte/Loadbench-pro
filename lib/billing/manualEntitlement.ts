import { prisma } from '@/lib/db/prisma';
import type { Workspace } from '@prisma/client';
import { FEATURE_KEYS, type FeatureKey } from './entitlements';

// Manual entitlement provider tag. Stored in the existing optional
// `bigcommerceCustomerEmail` column with a `manual:` prefix so the row is
// easy to identify as a manual grant without a destructive migration.
// (The schema retains BigCommerce fields verbatim; we just piggyback the
// email column for the operator audit handle.)
export const MANUAL_PROVIDER_TAG = 'manual';

export type ManualResolveResult =
  | { kind: 'workspace'; workspace: Workspace }
  | { kind: 'error'; message: string };

// Resolve a workspace by id, slug, or owner/member email. Falls back through
// (1) workspace id, (2) workspace slug, (3) first workspace owned/joined by
// the user whose email matches. Email matching is case-insensitive.
export async function resolveTargetWorkspace(
  target: { workspaceId?: string | null; email?: string | null },
): Promise<ManualResolveResult> {
  const workspaceId = target.workspaceId?.trim() || null;
  const email = target.email?.trim().toLowerCase() || null;

  if (workspaceId) {
    const byId = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (byId) return { kind: 'workspace', workspace: byId };
    const bySlug = await prisma.workspace.findUnique({
      where: { slug: workspaceId },
    });
    if (bySlug) return { kind: 'workspace', workspace: bySlug };
    return {
      kind: 'error',
      message: `No workspace found with id or slug "${workspaceId}".`,
    };
  }

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return {
        kind: 'error',
        message: `No LoadBench user with email "${email}". The user must sign in once before a manual grant can be applied.`,
      };
    }
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { workspace: true },
    });
    if (!member) {
      return {
        kind: 'error',
        message: `User "${email}" has no workspace membership.`,
      };
    }
    return { kind: 'workspace', workspace: member.workspace };
  }

  return {
    kind: 'error',
    message:
      'Provide a workspace id/slug or a user email to identify the grant target.',
  };
}

type GrantOptions = {
  workspaceId: string;
  featureKey?: FeatureKey;
  adminEmail: string;
  adminUserId?: string | null;
  reason?: string | null;
};

export async function grantManualEntitlement(opts: GrantOptions): Promise<void> {
  const featureKey = opts.featureKey ?? FEATURE_KEYS.PRESSURE_MODELING;
  const handle = `${MANUAL_PROVIDER_TAG}:${opts.adminEmail}`;

  const result = await prisma.workspaceEntitlement.upsert({
    where: {
      workspaceId_featureKey: {
        workspaceId: opts.workspaceId,
        featureKey,
      },
    },
    create: {
      workspaceId: opts.workspaceId,
      featureKey,
      status: 'ACTIVE',
      bigcommerceCustomerEmail: handle,
      cancelAtPeriodEnd: false,
    },
    update: {
      status: 'ACTIVE',
      bigcommerceCustomerEmail: handle,
      cancelAtPeriodEnd: false,
    },
  });

  await writeAudit({
    workspaceId: opts.workspaceId,
    adminUserId: opts.adminUserId ?? null,
    action: 'manual_entitlement.grant',
    entitlementId: result.id,
    featureKey,
    adminEmail: opts.adminEmail,
    reason: opts.reason ?? null,
  });
}

type RevokeOptions = {
  workspaceId: string;
  featureKey?: FeatureKey;
  adminEmail: string;
  adminUserId?: string | null;
  reason?: string | null;
};

export async function revokeManualEntitlement(
  opts: RevokeOptions,
): Promise<void> {
  const featureKey = opts.featureKey ?? FEATURE_KEYS.PRESSURE_MODELING;
  const existing = await prisma.workspaceEntitlement.findUnique({
    where: {
      workspaceId_featureKey: {
        workspaceId: opts.workspaceId,
        featureKey,
      },
    },
  });
  if (!existing) {
    // Nothing to revoke. Audit the no-op so the operator action is recorded.
    await writeAudit({
      workspaceId: opts.workspaceId,
      adminUserId: opts.adminUserId ?? null,
      action: 'manual_entitlement.revoke_noop',
      entitlementId: null,
      featureKey,
      adminEmail: opts.adminEmail,
      reason: opts.reason ?? null,
    });
    return;
  }

  await prisma.workspaceEntitlement.update({
    where: { id: existing.id },
    data: {
      status: 'CANCELED',
      cancelAtPeriodEnd: false,
    },
  });

  await writeAudit({
    workspaceId: opts.workspaceId,
    adminUserId: opts.adminUserId ?? null,
    action: 'manual_entitlement.revoke',
    entitlementId: existing.id,
    featureKey,
    adminEmail: opts.adminEmail,
    reason: opts.reason ?? null,
  });
}

type AuditFields = {
  workspaceId: string;
  adminUserId: string | null;
  action: string;
  entitlementId: string | null;
  featureKey: FeatureKey;
  adminEmail: string;
  reason: string | null;
};

async function writeAudit(fields: AuditFields): Promise<void> {
  const payload = JSON.stringify({
    adminEmail: fields.adminEmail,
    featureKey: fields.featureKey,
    reason: fields.reason,
    timestamp: new Date().toISOString(),
  });
  try {
    await prisma.auditEvent.create({
      data: {
        workspaceId: fields.workspaceId,
        userId: fields.adminUserId,
        entityType: 'WorkspaceEntitlement',
        entityId: fields.entitlementId ?? '-',
        action: fields.action,
        payload,
      },
    });
  } catch (err) {
    console.error('[manual-entitlement] audit log write failed', err);
  }
}

export type ManualEntitlementRow = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  featureKey: string;
  status: string;
  isManual: boolean;
  manualGrantedBy: string | null;
  bigcommerceOrderId: string | null;
  updatedAt: Date;
};

export async function listEntitlementsForAdmin(): Promise<ManualEntitlementRow[]> {
  const rows = await prisma.workspaceEntitlement.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 200,
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
  return rows.map((r) => {
    const tag = r.bigcommerceCustomerEmail ?? '';
    const isManual = tag.startsWith(`${MANUAL_PROVIDER_TAG}:`);
    const grantedBy = isManual
      ? tag.slice(MANUAL_PROVIDER_TAG.length + 1) || null
      : null;
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      workspaceName: r.workspace.name,
      workspaceSlug: r.workspace.slug,
      featureKey: r.featureKey,
      status: r.status,
      isManual,
      manualGrantedBy: grantedBy,
      bigcommerceOrderId: r.bigcommerceOrderId,
      updatedAt: r.updatedAt,
    };
  });
}

export type ManualEntitlementAuditRow = {
  id: string;
  workspaceId: string;
  action: string;
  adminEmail: string | null;
  reason: string | null;
  createdAt: Date;
};

export async function listManualEntitlementAudit(): Promise<
  ManualEntitlementAuditRow[]
> {
  const rows = await prisma.auditEvent.findMany({
    where: {
      entityType: 'WorkspaceEntitlement',
      action: {
        in: [
          'manual_entitlement.grant',
          'manual_entitlement.revoke',
          'manual_entitlement.revoke_noop',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map((r) => {
    let adminEmail: string | null = null;
    let reason: string | null = null;
    if (r.payload) {
      try {
        const parsed = JSON.parse(r.payload) as {
          adminEmail?: string;
          reason?: string | null;
        };
        adminEmail = parsed.adminEmail ?? null;
        reason = parsed.reason ?? null;
      } catch {
        // Ignore malformed payloads — audit row still rendered.
      }
    }
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      action: r.action,
      adminEmail,
      reason,
      createdAt: r.createdAt,
    };
  });
}
