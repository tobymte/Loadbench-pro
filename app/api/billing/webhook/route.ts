import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/db/prisma';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import {
  FEATURE_KEYS,
  stripeStatusToEntitlement,
  type FeatureKey,
} from '@/lib/billing/entitlements';

// App-router webhook for Stripe subscription lifecycle events.
//
// Stripe signs each webhook with STRIPE_WEBHOOK_SECRET. We must verify
// against the *raw* request body before doing anything else. Next.js app
// router gives us the raw body via `request.text()` on the route handler,
// which is what `stripe.webhooks.constructEvent` requires.
//
// Forcing the Node.js runtime keeps the stripe SDK happy (it depends on
// node crypto primitives) and ensures we can read the full body.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRESSURE_MODELING: FeatureKey = FEATURE_KEYS.PRESSURE_MODELING;

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this server.' },
      { status: 503 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET is not set.' },
      { status: 503 },
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header.' },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          stripe,
        );
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        // Other events are ignored — we only manage subscription state.
        break;
    }
  } catch (err) {
    // Log and 500 so Stripe retries; we still acknowledged signature ok.
    console.error('[stripe-webhook] handler error', event.type, err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
) {
  const workspaceId =
    session.metadata?.workspaceId ??
    (typeof session.client_reference_id === 'string'
      ? session.client_reference_id
      : null);
  const featureKey =
    (session.metadata?.featureKey as FeatureKey | undefined) ??
    PRESSURE_MODELING;

  if (!workspaceId) {
    console.warn('[stripe-webhook] checkout.session.completed without workspaceId');
    return;
  }

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null;

  // Pull the full subscription so we can persist status, price, period end.
  let subscription: Stripe.Subscription | null = null;
  if (subscriptionId) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  }

  await upsertEntitlement({
    workspaceId,
    featureKey,
    stripeCustomerId: customerId,
    subscription,
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata?.workspaceId ?? null;
  const featureKey =
    (subscription.metadata?.featureKey as FeatureKey | undefined) ??
    PRESSURE_MODELING;

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  if (!workspaceId) {
    // Fallback: find the entitlement by stripeSubscriptionId — the row was
    // likely created during checkout.session.completed.
    const existing = await prisma.workspaceEntitlement.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!existing) {
      console.warn(
        '[stripe-webhook] subscription event with no workspaceId metadata and no existing row',
        subscription.id,
      );
      return;
    }
    await upsertEntitlement({
      workspaceId: existing.workspaceId,
      featureKey: existing.featureKey as FeatureKey,
      stripeCustomerId: customerId,
      subscription,
    });
    return;
  }

  await upsertEntitlement({
    workspaceId,
    featureKey,
    stripeCustomerId: customerId,
    subscription,
  });
}

type UpsertArgs = {
  workspaceId: string;
  featureKey: FeatureKey;
  stripeCustomerId: string | null;
  subscription: Stripe.Subscription | null;
};

async function upsertEntitlement(args: UpsertArgs) {
  const { workspaceId, featureKey, stripeCustomerId, subscription } = args;

  const status = stripeStatusToEntitlement(subscription?.status);
  const priceId = subscription?.items?.data?.[0]?.price?.id ?? null;
  // Stripe's Subscription type carries current_period_end as a unix-seconds
  // number. Read it defensively in case future API versions reshape it.
  const periodEndRaw =
    subscription &&
    (subscription as unknown as { current_period_end?: number })
      .current_period_end;
  const currentPeriodEnd =
    typeof periodEndRaw === 'number' && Number.isFinite(periodEndRaw)
      ? new Date(periodEndRaw * 1000)
      : null;
  const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);

  await prisma.workspaceEntitlement.upsert({
    where: { workspaceId_featureKey: { workspaceId, featureKey } },
    create: {
      workspaceId,
      featureKey,
      status,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripeSubscriptionId: subscription?.id,
      stripePriceId: priceId ?? undefined,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    },
    update: {
      status,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripeSubscriptionId: subscription?.id,
      stripePriceId: priceId ?? undefined,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    },
  });
}
