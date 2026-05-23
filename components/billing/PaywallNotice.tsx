import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { EntitlementSummary } from '@/lib/billing/entitlements';

type Props = {
  // What the workspace would unlock by purchasing. Keep this list focused on
  // *infrastructure* that paid access enables (e.g. expanded review surfaces,
  // future advanced calculators). Never describe paid access as authorising
  // load recommendations or safe/unsafe verdicts.
  featureBullets: string[];
  // Current entitlement summary. Drives the cancel-at-period-end notice and
  // the button label (unlock vs. resubscribe).
  entitlement: EntitlementSummary;
  // Whether BigCommerce billing is currently configured on the server.
  // When false, the button is disabled and a notice explains.
  bigcommerceConfigured: boolean;
  // Anchor text for the heading. Defaults to a pressure-modeling label.
  title?: string;
  description?: string;
};

export function PaywallNotice({
  featureBullets,
  entitlement,
  bigcommerceConfigured,
  title = 'Premium: advanced pressure modeling',
  description = 'Paid access unlocks the advanced pressure-modeling workspace. Purchase does not grant load recommendations or safe/unsafe verdicts — all calculations remain experimental validation tools that must be verified against published manufacturer data.',
}: Props) {
  const hasPriorOrder = Boolean(entitlement.bigcommerceOrderId);
  return (
    <Card data-testid="paywall-notice">
      <CardHeader
        title={title}
        description={description}
        actions={<Badge tone="accent">Premium</Badge>}
      />
      <CardBody className="space-y-4">
        <ul className="text-[13px] text-text space-y-1 list-disc pl-5">
          {featureBullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>

        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-[12px] text-text"
          data-testid="paywall-safety-copy"
        >
          <strong className="font-semibold">
            Premium access is not load advice.
          </strong>{' '}
          A paid purchase unlocks additional review and bookkeeping
          surfaces. It does <em>not</em> turn LoadBench Pro into a load
          recommender. All calculations exposed by this app are experimental
          validation tools and must be independently verified against
          published manufacturer data before being used to inform any
          handload. See the{' '}
          <Link href="/safety" className="text-accent hover:text-accent-hover">
            safety policy
          </Link>
          .
        </div>

        {!bigcommerceConfigured && (
          <div
            className="rounded-md border border-border bg-bg-alt px-3 py-2 text-[12px] text-text-muted"
            data-testid="paywall-bigcommerce-unconfigured"
          >
            BigCommerce checkout is not configured on this deployment. Set
            <code className="mx-1 px-1 rounded bg-bg text-text-faint">BIGCOMMERCE_STORE_HASH</code>
            ,
            <code className="mx-1 px-1 rounded bg-bg text-text-faint">BIGCOMMERCE_ACCESS_TOKEN</code>
            , and
            <code className="mx-1 px-1 rounded bg-bg text-text-faint">BIGCOMMERCE_PRESSURE_PRODUCT_ID</code>
            to enable purchases.
          </div>
        )}

        {entitlement.cancelAtPeriodEnd && entitlement.currentPeriodEnd && (
          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-[12px] text-text"
            data-testid="paywall-cancel-notice"
          >
            Access is set to lapse at the end of the current period (
            {entitlement.currentPeriodEnd.toLocaleDateString()}).
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <form
            action="/api/billing/bigcommerce/checkout"
            method="post"
            data-testid="paywall-checkout-form"
          >
            <Button type="submit" disabled={!bigcommerceConfigured}>
              {hasPriorOrder
                ? 'Buy again on BigCommerce'
                : 'Unlock with BigCommerce Checkout'}
            </Button>
          </form>
          <p className="text-[11px] text-text-faint">
            Payment is handled by BigCommerce. You will be redirected to the
            BigCommerce hosted checkout to complete your purchase.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
