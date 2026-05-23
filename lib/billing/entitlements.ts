import { prisma } from '@/lib/db/prisma';
import type { EntitlementStatus, WorkspaceEntitlement } from '@prisma/client';

// Premium feature keys. Add new ones here as features are gated. The string
// values are persisted in the DB and referenced by Stripe metadata, so do not
// rename them without a data migration.
export const FEATURE_KEYS = {
  PRESSURE_MODELING: 'pressure_modeling',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

// Subscription statuses that grant access to the premium feature.
const ACTIVE_STATUSES: EntitlementStatus[] = ['ACTIVE', 'TRIALING'];

export type EntitlementSummary = {
  hasAccess: boolean;
  status: EntitlementStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  bigcommerceOrderId: string | null;
  bigcommerceCustomerId: string | null;
};

const INACTIVE_SUMMARY: EntitlementSummary = {
  hasAccess: false,
  status: 'INACTIVE',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  bigcommerceOrderId: null,
  bigcommerceCustomerId: null,
};

export function toSummary(
  e: WorkspaceEntitlement | null | undefined,
): EntitlementSummary {
  if (!e) return INACTIVE_SUMMARY;
  return {
    hasAccess: ACTIVE_STATUSES.includes(e.status),
    status: e.status,
    currentPeriodEnd: e.currentPeriodEnd,
    cancelAtPeriodEnd: e.cancelAtPeriodEnd,
    stripeCustomerId: e.stripeCustomerId,
    stripeSubscriptionId: e.stripeSubscriptionId,
    bigcommerceOrderId: e.bigcommerceOrderId,
    bigcommerceCustomerId: e.bigcommerceCustomerId
      ? String(e.bigcommerceCustomerId)
      : null,
  };
}

export async function getEntitlement(
  workspaceId: string,
  featureKey: FeatureKey,
): Promise<EntitlementSummary> {
  const row = await prisma.workspaceEntitlement.findUnique({
    where: { workspaceId_featureKey: { workspaceId, featureKey } },
  });
  return toSummary(row);
}

export async function hasPremiumAccess(
  workspaceId: string,
  featureKey: FeatureKey,
): Promise<boolean> {
  const summary = await getEntitlement(workspaceId, featureKey);
  return summary.hasAccess;
}

// Map a Stripe Subscription.status string to our EntitlementStatus enum.
// Unknown / unhandled statuses fall back to INACTIVE so a malformed event
// can never grant access.
export function stripeStatusToEntitlement(
  status: string | null | undefined,
): EntitlementStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'incomplete':
      return 'INCOMPLETE';
    case 'incomplete_expired':
      return 'INCOMPLETE_EXPIRED';
    case 'unpaid':
      return 'UNPAID';
    case 'paused':
      return 'PAUSED';
    default:
      return 'INACTIVE';
  }
}
