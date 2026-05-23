import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import {
  getBigCommerceConfig,
  getOrder,
  isBigCommerceConfigured,
  isOrderPaid,
  type BigCommerceOrder,
} from '@/lib/billing/bigcommerce';
import { FEATURE_KEYS, type FeatureKey } from '@/lib/billing/entitlements';

// BigCommerce order/payment webhook.
//
// BigCommerce posts a small JSON envelope describing the event; the order
// details are not included, so we fetch them via the REST API and only
// grant entitlement when the order is in a paid state.
//
// Signature verification: BigCommerce webhooks can be configured with a
// signed header (`x-bc-webhook-signature` as an HMAC-SHA256 of the raw
// body using the configured webhook secret). If a secret is configured
// in env (BIGCOMMERCE_WEBHOOK_SECRET) we verify; otherwise we accept the
// request but log a warning. This matches the platform's optional
// signature feature without locking out stores that haven't enabled it.
//
// We never grant access on unpaid / pending events.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRESSURE_MODELING: FeatureKey = FEATURE_KEYS.PRESSURE_MODELING;

type BcWebhookEnvelope = {
  scope?: string;
  hash?: string;
  store_id?: string;
  data?: {
    type?: string;
    id?: number | string;
    orderId?: number | string;
  };
};

function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  // Strip optional algo prefix (e.g. "sha256=").
  const provided = header.includes('=') ? header.split('=').slice(-1)[0] : header;
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isBigCommerceConfigured()) {
    return NextResponse.json(
      { error: 'BigCommerce is not configured on this server.' },
      { status: 503 },
    );
  }

  const cfg = getBigCommerceConfig();
  const rawBody = await request.text();

  if (cfg.webhookSecret) {
    const signatureHeader =
      request.headers.get('x-bc-webhook-signature') ??
      request.headers.get('x-bc-signature') ??
      null;
    if (!verifySignature(rawBody, signatureHeader, cfg.webhookSecret)) {
      return NextResponse.json(
        { error: 'BigCommerce webhook signature verification failed.' },
        { status: 400 },
      );
    }
  } else {
    console.warn(
      '[bigcommerce-webhook] no BIGCOMMERCE_WEBHOOK_SECRET configured — accepting unsigned event.',
    );
  }

  let envelope: BcWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as BcWebhookEnvelope;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const scope = envelope.scope ?? '';
  // Only act on order create / status update / payment events.
  const isOrderEvent =
    scope.startsWith('store/order/') ||
    scope === 'store/order/created' ||
    scope === 'store/order/updated' ||
    scope === 'store/order/statusUpdated' ||
    scope === 'store/order/transaction/created';
  if (!isOrderEvent) {
    return NextResponse.json({ received: true, ignored: scope });
  }

  const orderIdRaw = envelope.data?.id ?? envelope.data?.orderId ?? null;
  if (orderIdRaw === null || orderIdRaw === undefined) {
    return NextResponse.json(
      { error: 'BigCommerce webhook envelope missing order id.' },
      { status: 400 },
    );
  }

  let order: BigCommerceOrder;
  try {
    order = await getOrder(orderIdRaw);
  } catch (err) {
    console.error('[bigcommerce-webhook] order fetch failed', err);
    return NextResponse.json(
      { error: 'Failed to retrieve order from BigCommerce.' },
      { status: 502 },
    );
  }

  if (!isOrderPaid(order)) {
    // Persist customer-info on the cart-linked row if we can find it, but
    // do NOT grant access until the order is paid.
    await persistPendingOrder(order).catch((err) => {
      console.error('[bigcommerce-webhook] pending order persist failed', err);
    });
    return NextResponse.json({ received: true, granted: false });
  }

  try {
    const result = await grantEntitlementForOrder(order);
    return NextResponse.json({ received: true, granted: result.granted });
  } catch (err) {
    console.error('[bigcommerce-webhook] entitlement upsert failed', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}

async function persistPendingOrder(order: BigCommerceOrder): Promise<void> {
  // Try to find an entitlement row by cart id (set during checkout). If
  // found, attach the order id and customer metadata so an operator can
  // see the pending order in the DB.
  if (!order.cart_id) return;
  const row = await prisma.workspaceEntitlement.findFirst({
    where: { bigcommerceCartId: order.cart_id },
  });
  if (!row) return;
  await prisma.workspaceEntitlement.update({
    where: { id: row.id },
    data: {
      bigcommerceOrderId: String(order.id),
      bigcommerceCustomerId:
        order.customer_id !== undefined ? String(order.customer_id) : null,
      bigcommerceCustomerEmail: order.billing_address?.email ?? null,
    },
  });
}

async function grantEntitlementForOrder(
  order: BigCommerceOrder,
): Promise<{ granted: boolean }> {
  const featureKey: FeatureKey = PRESSURE_MODELING;
  const customerEmail = order.billing_address?.email ?? null;
  const customerId =
    order.customer_id !== undefined ? String(order.customer_id) : null;
  const orderId = String(order.id);

  // Match strategy (in order):
  //   1. Existing entitlement row matching this order id (idempotent retry).
  //   2. Existing entitlement row matching the cart id created during checkout.
  //   3. Existing entitlement row matching the customer email (best-effort
  //      when the cart→order metadata link was lost, requires that the
  //      BigCommerce shopper email matches the LoadBench account email).
  //
  // If none of the above match, the order is dropped with a console warning
  // — there is intentionally no "create new row by email" path because
  // emails are not authenticated identifiers in this context.

  const byOrder = await prisma.workspaceEntitlement.findUnique({
    where: { bigcommerceOrderId: orderId },
  });
  if (byOrder) {
    await applyPaidUpdate(byOrder.workspaceId, featureKey, {
      bigcommerceOrderId: orderId,
      bigcommerceCustomerId: customerId,
      bigcommerceCustomerEmail: customerEmail,
    });
    return { granted: true };
  }

  if (order.cart_id) {
    const byCart = await prisma.workspaceEntitlement.findFirst({
      where: { bigcommerceCartId: order.cart_id },
    });
    if (byCart) {
      await applyPaidUpdate(byCart.workspaceId, featureKey, {
        bigcommerceOrderId: orderId,
        bigcommerceCustomerId: customerId,
        bigcommerceCustomerEmail: customerEmail,
      });
      return { granted: true };
    }
  }

  if (customerEmail) {
    const user = await prisma.user.findUnique({
      where: { email: customerEmail.toLowerCase() },
    });
    if (user) {
      const member = await prisma.workspaceMember.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });
      if (member) {
        await applyPaidUpdate(member.workspaceId, featureKey, {
          bigcommerceOrderId: orderId,
          bigcommerceCustomerId: customerId,
          bigcommerceCustomerEmail: customerEmail,
        });
        return { granted: true };
      }
    }
  }

  console.warn(
    `[bigcommerce-webhook] order ${orderId} could not be matched to a workspace. ` +
      `Configure cart metadata or ensure the BigCommerce billing email matches ` +
      `the LoadBench account email, or grant access manually.`,
  );
  return { granted: false };
}

type PaidFields = {
  bigcommerceOrderId: string;
  bigcommerceCustomerId: string | null;
  bigcommerceCustomerEmail: string | null;
};

async function applyPaidUpdate(
  workspaceId: string,
  featureKey: FeatureKey,
  fields: PaidFields,
): Promise<void> {
  await prisma.workspaceEntitlement.upsert({
    where: { workspaceId_featureKey: { workspaceId, featureKey } },
    create: {
      workspaceId,
      featureKey,
      status: 'ACTIVE',
      bigcommerceOrderId: fields.bigcommerceOrderId,
      bigcommerceCustomerId: fields.bigcommerceCustomerId,
      bigcommerceCustomerEmail: fields.bigcommerceCustomerEmail,
    },
    update: {
      status: 'ACTIVE',
      bigcommerceOrderId: fields.bigcommerceOrderId,
      bigcommerceCustomerId: fields.bigcommerceCustomerId,
      bigcommerceCustomerEmail: fields.bigcommerceCustomerEmail,
    },
  });
}
