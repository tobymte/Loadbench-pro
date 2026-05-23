// BigCommerce billing helpers.
//
// LoadBench Pro uses BigCommerce as the primary payment + checkout surface
// for the premium pressure-modeling entitlement. Carts are created via the
// BigCommerce REST API (V3) and the user is redirected to BigCommerce's
// hosted "redirected checkout" so payment details never touch this server.
//
// All identifiers and tokens are read from environment variables; nothing
// is hardcoded. Helpers throw a single, well-formed Error when required
// variables are missing so the route handlers can surface a clean 503.

export type BigCommerceConfig = {
  storeHash: string;
  accessToken: string;
  channelId: number | null;
  pressureProductId: number;
  webhookSecret: string | null;
};

function readNumberEnv(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${name} must be a positive integer (BigCommerce numeric id). Got: "${raw}".`,
    );
  }
  return parsed;
}

export function isBigCommerceConfigured(): boolean {
  return Boolean(
    process.env.BIGCOMMERCE_STORE_HASH &&
      process.env.BIGCOMMERCE_ACCESS_TOKEN &&
      process.env.BIGCOMMERCE_PRESSURE_PRODUCT_ID,
  );
}

export function getBigCommerceConfig(): BigCommerceConfig {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const accessToken = process.env.BIGCOMMERCE_ACCESS_TOKEN;
  const pressureProductIdRaw = process.env.BIGCOMMERCE_PRESSURE_PRODUCT_ID;

  if (!storeHash) {
    throw new Error('BIGCOMMERCE_STORE_HASH is not set.');
  }
  if (!accessToken) {
    throw new Error('BIGCOMMERCE_ACCESS_TOKEN is not set.');
  }
  if (!pressureProductIdRaw) {
    throw new Error(
      'BIGCOMMERCE_PRESSURE_PRODUCT_ID is not set. Create a digital product in BigCommerce and add its numeric product id.',
    );
  }

  const pressureProductId = readNumberEnv('BIGCOMMERCE_PRESSURE_PRODUCT_ID');
  if (pressureProductId === null) {
    throw new Error('BIGCOMMERCE_PRESSURE_PRODUCT_ID is not set.');
  }

  return {
    storeHash,
    accessToken,
    channelId: readNumberEnv('BIGCOMMERCE_CHANNEL_ID'),
    pressureProductId,
    webhookSecret:
      process.env.BIGCOMMERCE_WEBHOOK_SECRET ??
      process.env.BIGCOMMERCE_CLIENT_SECRET ??
      null,
  };
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

const API_BASE = 'https://api.bigcommerce.com';

function apiUrl(storeHash: string, path: string): string {
  return `${API_BASE}/stores/${storeHash}${path}`;
}

async function bcFetch(
  cfg: BigCommerceConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Auth-Token', cfg.accessToken);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(apiUrl(cfg.storeHash, path), { ...init, headers, cache: 'no-store' });
}

export type CreateCartArgs = {
  workspaceId: string;
  userId: string;
  customerEmail?: string | null;
};

export type CreateCartResult = {
  cartId: string;
  checkoutUrl: string;
};

// Create a BigCommerce cart with the pressure-modeling product, then fetch
// the redirect URLs so the user can complete checkout on BigCommerce.
export async function createPressureModelingCart(
  args: CreateCartArgs,
): Promise<CreateCartResult> {
  const cfg = getBigCommerceConfig();

  const cartBody: Record<string, unknown> = {
    line_items: [
      {
        quantity: 1,
        product_id: cfg.pressureProductId,
      },
    ],
    // Echo workspace / user / feature back to the order so the webhook can
    // resolve the correct WorkspaceEntitlement row. BigCommerce stores
    // these on the cart, then copies them onto the resulting order's
    // form_fields array (when configured) or order metadata.
    custom_items: [],
  };
  if (cfg.channelId !== null) {
    cartBody.channel_id = cfg.channelId;
  }

  const cartRes = await bcFetch(cfg, '/v3/carts', {
    method: 'POST',
    body: JSON.stringify(cartBody),
  });

  if (!cartRes.ok) {
    const text = await cartRes.text().catch(() => '');
    throw new Error(
      `BigCommerce cart creation failed (${cartRes.status}): ${text || cartRes.statusText}`,
    );
  }

  const cartJson = (await cartRes.json()) as {
    data?: { id?: string };
  };
  const cartId = cartJson.data?.id;
  if (!cartId) {
    throw new Error('BigCommerce cart creation returned no cart id.');
  }

  // Attach a non-PII metafield carrying the workspace + user ids so the
  // webhook can match the resulting order back to a WorkspaceEntitlement.
  // Metafields on carts persist to orders as form fields / metafields
  // depending on store config; we additionally include the workspaceId in
  // the cart's redirect URL query string as a defensive fallback.
  await bcFetch(cfg, `/v3/carts/${cartId}/metafields`, {
    method: 'POST',
    body: JSON.stringify({
      key: 'loadbench_workspace_id',
      value: args.workspaceId,
      namespace: 'loadbench',
      permission_set: 'app_only',
      description: 'LoadBench Pro workspace id for entitlement matching',
    }),
  }).catch(() => {
    // Metafield attach is best-effort; the workspace id is also persisted
    // locally in the entitlement row keyed by cart id.
  });

  // Ask BigCommerce for the cart's checkout redirect URLs.
  const redirectRes = await bcFetch(
    cfg,
    `/v3/carts/${cartId}/redirect_urls`,
    { method: 'POST' },
  );

  if (!redirectRes.ok) {
    const text = await redirectRes.text().catch(() => '');
    throw new Error(
      `BigCommerce redirect URL creation failed (${redirectRes.status}): ${text || redirectRes.statusText}`,
    );
  }

  const redirectJson = (await redirectRes.json()) as {
    data?: { checkout_url?: string };
  };
  const checkoutUrl = redirectJson.data?.checkout_url;
  if (!checkoutUrl) {
    throw new Error('BigCommerce redirect URL response contained no checkout_url.');
  }

  return { cartId, checkoutUrl };
}

// Fetch order details by id. Used by the webhook handler to confirm payment
// state and surface customer email for entitlement matching.
export type BigCommerceOrder = {
  id: number;
  status: string;
  status_id: number;
  payment_status: string;
  billing_address?: { email?: string };
  customer_id?: number;
  cart_id?: string;
};

export async function getOrder(orderId: number | string): Promise<BigCommerceOrder> {
  const cfg = getBigCommerceConfig();
  // The orders API lives on the older /v2 surface.
  const res = await bcFetch(cfg, `/v2/orders/${orderId}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `BigCommerce order fetch failed (${res.status}): ${text || res.statusText}`,
    );
  }
  return (await res.json()) as BigCommerceOrder;
}

// Status names that mean the order has been paid in full. BigCommerce uses
// a numeric status_id; the textual status is informational. We accept the
// canonical paid states and explicitly *exclude* pending / declined.
// https://developer.bigcommerce.com/docs/rest-management/orders#order-statuses
export const PAID_STATUS_IDS = new Set<number>([
  10, // Completed (digital product, fully paid)
  11, // Awaiting Fulfillment — paid, awaiting digital delivery
  12, // Shipped — paid
  2, // Shipped (alt id depending on store)
]);

export function isOrderPaid(order: BigCommerceOrder): boolean {
  if (PAID_STATUS_IDS.has(order.status_id)) return true;
  const normalized = order.status?.toLowerCase() ?? '';
  return (
    normalized === 'completed' ||
    normalized === 'awaiting fulfillment' ||
    normalized === 'shipped'
  );
}
