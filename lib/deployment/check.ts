// Deployment diagnostics — inspects the environment for required and optional
// configuration and reports it without ever returning secret values. The
// presence/length of a secret is OK; its content is not.

export type CheckStatus = 'ok' | 'warn' | 'missing' | 'info';

export type CheckResult = {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  // Optional one-line remediation hint shown next to the check row.
  fix?: string;
};

export type CheckGroup = {
  group: string;
  description: string;
  checks: CheckResult[];
};

function presence(name: string): {
  present: boolean;
  length: number;
  value: string | undefined;
} {
  const v = process.env[name];
  return {
    present: typeof v === 'string' && v.length > 0,
    length: typeof v === 'string' ? v.length : 0,
    value: v,
  };
}

function host(url: string | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '(unparseable URL)';
  }
}

export function collectChecks(): CheckGroup[] {
  const isProd = process.env.NODE_ENV === 'production';
  const vercel = !!process.env.VERCEL;
  const disableAuth = process.env.LOADBENCH_DISABLE_AUTH === 'true';

  const groups: CheckGroup[] = [];

  // --- Database -----------------------------------------------------------
  {
    const db = presence('DATABASE_URL');
    const direct = presence('DIRECT_URL');
    groups.push({
      group: 'Database (Neon / Postgres)',
      description:
        'DATABASE_URL is required for the Next.js app. DIRECT_URL is required for Prisma Migrate on Neon/Supabase.',
      checks: [
        {
          key: 'DATABASE_URL',
          label: 'DATABASE_URL',
          status: db.present ? 'ok' : 'missing',
          detail: db.present
            ? `set (host ${host(db.value)})`
            : 'unset — app routes that read from Postgres will degrade to setup notices',
          fix: db.present
            ? undefined
            : 'Add the pooled Neon connection string in Vercel → Project → Settings → Environment Variables.',
        },
        {
          key: 'DIRECT_URL',
          label: 'DIRECT_URL',
          status: direct.present ? 'ok' : 'warn',
          detail: direct.present
            ? `set (host ${host(direct.value)})`
            : 'unset — Prisma Migrate against Neon/Supabase will fail',
          fix: direct.present
            ? undefined
            : 'Add the non-pooled connection string. Used by `prisma migrate deploy`.',
        },
      ],
    });
  }

  // --- Clerk auth ---------------------------------------------------------
  {
    const pk = presence('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    const sk = presence('CLERK_SECRET_KEY');
    groups.push({
      group: 'Clerk authentication',
      description:
        'Both keys are required in production. LOADBENCH_DISABLE_AUTH=true bypasses Clerk for local development.',
      checks: [
        {
          key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
          label: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
          status: pk.present ? 'ok' : isProd ? 'missing' : 'warn',
          detail: pk.present ? 'set' : 'unset',
        },
        {
          key: 'CLERK_SECRET_KEY',
          label: 'CLERK_SECRET_KEY',
          status: sk.present ? 'ok' : isProd ? 'missing' : 'warn',
          detail: sk.present ? 'set' : 'unset',
        },
        {
          key: 'LOADBENCH_DISABLE_AUTH',
          label: 'LOADBENCH_DISABLE_AUTH',
          status: disableAuth
            ? isProd
              ? 'warn'
              : 'info'
            : 'ok',
          detail: disableAuth
            ? isProd
              ? 'true (UNSAFE in production — disables Clerk gating)'
              : 'true (local dev only)'
            : 'unset / false (auth enforced)',
          fix:
            disableAuth && isProd
              ? 'Remove or set to "false" in the production Vercel environment.'
              : undefined,
        },
      ],
    });
  }

  // --- Admin gating -------------------------------------------------------
  {
    const adminEmails = (process.env.LOADBENCH_ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    groups.push({
      group: 'Admin gating',
      description:
        'LOADBENCH_ADMIN_EMAILS controls access to the operator-only pages (entitlements, model validation, deployment check).',
      checks: [
        {
          key: 'LOADBENCH_ADMIN_EMAILS',
          label: 'LOADBENCH_ADMIN_EMAILS',
          status:
            adminEmails.length > 0 ? 'ok' : isProd ? 'warn' : 'info',
          detail:
            adminEmails.length > 0
              ? `${adminEmails.length} email${adminEmails.length === 1 ? '' : 's'} configured`
              : 'unset (admin pages locked unless LOADBENCH_DISABLE_AUTH=true)',
          fix:
            adminEmails.length === 0
              ? 'Add a comma-separated list of Clerk-account emails for operators.'
              : undefined,
        },
      ],
    });
  }

  // --- Ballistics engine --------------------------------------------------
  {
    const ball = presence('BALLISTICS_ENGINE_URL');
    groups.push({
      group: 'External ballistics engine (.NET)',
      description:
        'Separate ASP.NET Core service for downrange trajectory. Leave unset to render setup help on /ballistics instead of crashing.',
      checks: [
        {
          key: 'BALLISTICS_ENGINE_URL',
          label: 'BALLISTICS_ENGINE_URL',
          status: ball.present ? 'ok' : 'info',
          detail: ball.present
            ? `set (host ${host(ball.value)})`
            : 'unset — /ballistics shows a setup card; trajectory API returns 503 service_unconfigured',
          fix: ball.present
            ? undefined
            : 'Deploy services/ballistics-engine and set this to its HTTPS URL.',
        },
      ],
    });
  }

  // --- BigCommerce (premium checkout) ------------------------------------
  {
    const storeHash = presence('BIGCOMMERCE_STORE_HASH');
    const apiToken = presence('BIGCOMMERCE_API_TOKEN');
    const channelId = presence('BIGCOMMERCE_CHANNEL_ID');
    const webhookSecret = presence('BIGCOMMERCE_WEBHOOK_SECRET');
    const anyConfigured =
      storeHash.present ||
      apiToken.present ||
      channelId.present ||
      webhookSecret.present;
    const fullyConfigured =
      storeHash.present &&
      apiToken.present &&
      channelId.present &&
      webhookSecret.present;
    groups.push({
      group: 'BigCommerce (premium checkout)',
      description:
        'Optional. Premium pressure-engine UI is unlocked by admin manual entitlement when BigCommerce is not configured.',
      checks: [
        {
          key: 'BIGCOMMERCE_STORE_HASH',
          label: 'BIGCOMMERCE_STORE_HASH',
          status: storeHash.present ? 'ok' : anyConfigured ? 'warn' : 'info',
          detail: storeHash.present ? 'set' : 'unset',
        },
        {
          key: 'BIGCOMMERCE_API_TOKEN',
          label: 'BIGCOMMERCE_API_TOKEN',
          status: apiToken.present ? 'ok' : anyConfigured ? 'warn' : 'info',
          detail: apiToken.present ? `set (${apiToken.length} chars)` : 'unset',
        },
        {
          key: 'BIGCOMMERCE_CHANNEL_ID',
          label: 'BIGCOMMERCE_CHANNEL_ID',
          status: channelId.present ? 'ok' : anyConfigured ? 'warn' : 'info',
          detail: channelId.present ? 'set' : 'unset',
        },
        {
          key: 'BIGCOMMERCE_WEBHOOK_SECRET',
          label: 'BIGCOMMERCE_WEBHOOK_SECRET',
          status: webhookSecret.present
            ? 'ok'
            : anyConfigured
              ? 'warn'
              : 'info',
          detail: webhookSecret.present
            ? `set (${webhookSecret.length} chars)`
            : 'unset',
          fix:
            anyConfigured && !fullyConfigured
              ? 'Set every BigCommerce variable or unset all of them — partial configuration silently breaks webhooks.'
              : undefined,
        },
      ],
    });
  }

  // --- Stripe (legacy) ----------------------------------------------------
  {
    const stripeKey = presence('STRIPE_SECRET_KEY');
    const stripeHook = presence('STRIPE_WEBHOOK_SECRET');
    groups.push({
      group: 'Stripe (legacy)',
      description:
        'Retained for back-compat. Production uses BigCommerce for new premium checkouts.',
      checks: [
        {
          key: 'STRIPE_SECRET_KEY',
          label: 'STRIPE_SECRET_KEY',
          status: stripeKey.present ? 'info' : 'info',
          detail: stripeKey.present ? 'set' : 'unset (expected)',
        },
        {
          key: 'STRIPE_WEBHOOK_SECRET',
          label: 'STRIPE_WEBHOOK_SECRET',
          status: stripeHook.present ? 'info' : 'info',
          detail: stripeHook.present ? 'set' : 'unset (expected)',
        },
      ],
    });
  }

  // --- App identity -------------------------------------------------------
  {
    const appUrl = presence('NEXT_PUBLIC_APP_URL');
    const appName = presence('NEXT_PUBLIC_APP_NAME');
    groups.push({
      group: 'App identity',
      description:
        'Used for branding, redirects and email subjects. NEXT_PUBLIC_APP_URL must match the live Vercel deployment URL in production.',
      checks: [
        {
          key: 'NEXT_PUBLIC_APP_URL',
          label: 'NEXT_PUBLIC_APP_URL',
          status: appUrl.present
            ? 'ok'
            : isProd
              ? 'warn'
              : 'info',
          detail: appUrl.present
            ? `set (${host(appUrl.value)})`
            : 'unset',
        },
        {
          key: 'NEXT_PUBLIC_APP_NAME',
          label: 'NEXT_PUBLIC_APP_NAME',
          status: appName.present ? 'ok' : 'info',
          detail: appName.present ? 'set' : 'unset (defaults to "LoadBench Pro")',
        },
        {
          key: 'VERCEL',
          label: 'Running on Vercel',
          status: vercel ? 'ok' : 'info',
          detail: vercel
            ? `yes (env ${process.env.VERCEL_ENV ?? 'unknown'})`
            : 'no',
        },
      ],
    });
  }

  return groups;
}

export function summarize(groups: CheckGroup[]) {
  let ok = 0;
  let warn = 0;
  let missing = 0;
  let info = 0;
  for (const g of groups) {
    for (const c of g.checks) {
      if (c.status === 'ok') ok += 1;
      else if (c.status === 'warn') warn += 1;
      else if (c.status === 'missing') missing += 1;
      else info += 1;
    }
  }
  return { ok, warn, missing, info };
}
