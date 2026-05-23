import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { prisma } from '@/lib/db/prisma';
import {
  createPressureModelingCart,
  isBigCommerceConfigured,
} from '@/lib/billing/bigcommerce';
import { FEATURE_KEYS } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Creates a BigCommerce cart with the pressure-modeling digital product and
// 303-redirects the caller to BigCommerce's hosted "redirected checkout"
// so payment details never touch this server.
//
// The cart id is persisted on the WorkspaceEntitlement row (status remains
// INACTIVE until the webhook confirms a paid order). This lets the webhook
// fall back to cart-id lookup if the order metadata does not echo the
// workspace id.
export async function POST() {
  if (!isBigCommerceConfigured()) {
    return NextResponse.json(
      {
        error:
          'BigCommerce is not configured on this server. Set BIGCOMMERCE_STORE_HASH, BIGCOMMERCE_ACCESS_TOKEN, and BIGCOMMERCE_PRESSURE_PRODUCT_ID.',
      },
      { status: 503 },
    );
  }

  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const featureKey = FEATURE_KEYS.PRESSURE_MODELING;

  let checkoutUrl: string;
  let cartId: string;
  try {
    const result = await createPressureModelingCart({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    checkoutUrl = result.checkoutUrl;
    cartId = result.cartId;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CHECKOUT_FAILED';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Best-effort: persist the cart id so the webhook can resolve workspace
  // by cart even if no order metadata is present. We don't grant access
  // here; the entitlement stays INACTIVE until the webhook confirms paid.
  try {
    await prisma.workspaceEntitlement.upsert({
      where: {
        workspaceId_featureKey: {
          workspaceId: ctx.workspaceId,
          featureKey,
        },
      },
      create: {
        workspaceId: ctx.workspaceId,
        featureKey,
        bigcommerceCartId: cartId,
      },
      update: {
        bigcommerceCartId: cartId,
      },
    });
  } catch (err) {
    // Don't block checkout on a persistence hiccup; the webhook can still
    // recover via order metadata / email matching.
    console.error('[bigcommerce-checkout] failed to persist cart id', err);
  }

  return NextResponse.redirect(checkoutUrl, { status: 303 });
}
