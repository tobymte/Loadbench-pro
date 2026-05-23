import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { prisma } from '@/lib/db/prisma';
import {
  getAppUrl,
  getPressureModelingPriceId,
  getStripe,
  isStripeConfigured,
} from '@/lib/billing/stripe';
import { FEATURE_KEYS } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Creates a Stripe Checkout session for the pressure-modeling subscription
// and redirects the caller to the hosted Checkout page. The feature key and
// workspace id are echoed back via metadata so the webhook can resolve the
// correct WorkspaceEntitlement row on completion.
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

  let priceId: string;
  try {
    priceId = getPressureModelingPriceId();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PRICE_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  const featureKey = FEATURE_KEYS.PRESSURE_MODELING;

  // Re-use an existing Stripe customer id if we've already attached one for
  // this workspace+feature, so the user lands on the same customer record.
  const existing = await prisma.workspaceEntitlement.findUnique({
    where: { workspaceId_featureKey: { workspaceId: ctx.workspaceId, featureKey } },
  });

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/pressure-modeling?checkout=success`,
    cancel_url: `${appUrl}/pressure-modeling?checkout=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: ctx.workspaceId,
    customer: existing?.stripeCustomerId ?? undefined,
    metadata: {
      workspaceId: ctx.workspaceId,
      featureKey,
      userId: ctx.userId,
    },
    subscription_data: {
      metadata: {
        workspaceId: ctx.workspaceId,
        featureKey,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: 'Stripe did not return a checkout URL.' },
      { status: 502 },
    );
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
