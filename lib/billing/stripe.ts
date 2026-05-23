import Stripe from 'stripe';

// Lazy server-side Stripe client. Module-level singleton so we re-use the same
// HTTP agent across handlers. The secret key is intentionally read at call
// time so that importing this module in client bundles (which would be a bug,
// but defence-in-depth) does not throw at evaluation time.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Stripe billing endpoints are disabled.',
    );
  }
  cached = new Stripe(secret, {
    // Pin to the SDK's bundled API version so type-checks stay aligned.
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    appInfo: {
      name: 'LoadBench Pro',
      url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    },
  });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getPressureModelingPriceId(): string {
  const id = process.env.STRIPE_PRESSURE_MODELING_PRICE_ID;
  if (!id) {
    throw new Error(
      'STRIPE_PRESSURE_MODELING_PRICE_ID is not set. Create a Stripe Price and add it to env.',
    );
  }
  return id;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
