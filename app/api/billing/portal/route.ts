import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { prisma } from '@/lib/db/prisma';
import { getAppUrl, getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import { FEATURE_KEYS } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Opens the Stripe Billing Portal for the workspace's existing customer.
// 404s if the workspace has never started a Stripe subscription.
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this server.' },
      { status: 503 },
    );
  }

  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const entitlement = await prisma.workspaceEntitlement.findUnique({
    where: {
      workspaceId_featureKey: {
        workspaceId: ctx.workspaceId,
        featureKey: FEATURE_KEYS.PRESSURE_MODELING,
      },
    },
  });

  if (!entitlement?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No Stripe customer on file for this workspace.' },
      { status: 404 },
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: entitlement.stripeCustomerId,
    return_url: `${getAppUrl()}/pressure-modeling`,
  });

  return NextResponse.redirect(session.url, { status: 303 });
}
