import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { EntitlementSummary } from '@/lib/billing/entitlements';

type Props = {
  // What the workspace would unlock by subscribing. Keep this list focused on
  // *infrastructure* that paid access enables (e.g. expanded review surfaces,
  // future advanced calculators). Never describe paid access as authorising
  // load recommendations or safe/unsafe verdicts.
  featureBullets: string[];
  // Current entitlement summary. Drives the button surface (subscribe vs.
  // manage billing) and the cancel-at-period-end notice.
  entitlement: EntitlementSummary;
  // Whether Stripe is currently configured on the server. When false, we
  // disable the subscribe form and explain that billing is unavailable here.
  stripeConfigured: boolean;
  // Anchor text for the heading. Defaults to a pressure-modeling label.
  title?: string;
  description?: string;
};

export function PaywallNotice({
  featureBullets,
  entitlement,
  stripeConfigured,
  title = 'Premium: advanced pressure modeling',
  description = 'Paid subscription unlocks the advanced pressure-modeling workspace. Subscription does not grant load recommendations or safe/unsafe verdicts — all calculations remain experimental validation tools that must be verified against published manufacturer data.',
}: Props) {
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
          A paid subscription unlocks additional review and bookkeeping
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

        {!stripeConfigured && (
          <div
            className="rounded-md border border-border bg-bg-alt px-3 py-2 text-[12px] text-text-muted"
            data-testid="paywall-stripe-unconfigured"
          >
            Billing is not configured on this deployment. Set
            <code className="mx-1 px-1 rounded bg-bg text-text-faint">STRIPE_SECRET_KEY</code>
            and related variables to enable subscriptions.
          </div>
        )}

        {entitlement.cancelAtPeriodEnd && entitlement.currentPeriodEnd && (
          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-[12px] text-text"
            data-testid="paywall-cancel-notice"
          >
            Subscription is set to cancel at the end of the current period (
            {entitlement.currentPeriodEnd.toLocaleDateString()}). Use the
            billing portal to resume.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {entitlement.stripeCustomerId ? (
            <form
              action="/api/billing/portal"
              method="post"
              data-testid="paywall-portal-form"
            >
              <Button
                type="submit"
                variant="secondary"
                disabled={!stripeConfigured}
              >
                Manage billing
              </Button>
            </form>
          ) : null}
          <form
            action="/api/billing/checkout"
            method="post"
            data-testid="paywall-checkout-form"
          >
            <Button type="submit" disabled={!stripeConfigured}>
              {entitlement.stripeCustomerId
                ? 'Resubscribe'
                : 'Subscribe to unlock'}
            </Button>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
