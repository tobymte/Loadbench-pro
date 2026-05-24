import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getAdminContext } from '@/lib/auth/admin';

// /settings/deployment
//
// User-facing summary of the deployment requirements. Lists the steps every
// operator must complete to host LoadBench Pro on Vercel + Neon + Clerk. The
// detailed env-var diagnostics page is operator-only and linked from here.

export const dynamic = 'force-dynamic';

const STEPS: Array<{
  title: string;
  body: string;
  bullets: string[];
}> = [
  {
    title: '1. Provision Postgres (Neon recommended)',
    body: 'LoadBench Pro stores all data in Postgres via Prisma. The Vercel ↔ Neon integration is the simplest path.',
    bullets: [
      'Create a Neon project and copy both the pooled and non-pooled connection strings.',
      'Set DATABASE_URL (pooled) and DIRECT_URL (non-pooled) in Vercel.',
      'Run `npx prisma migrate deploy` against the new database from a workstation, or rely on the Vercel build step (which runs `prisma generate` only).',
    ],
  },
  {
    title: '2. Configure Clerk',
    body: 'Sign-in / sign-up and workspace membership rely on Clerk. Two keys are required.',
    bullets: [
      'Create a Clerk application; copy the Publishable Key and Secret Key.',
      'Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in Vercel.',
      'Optional: override the sign-in / sign-up redirect URLs if you do not want /dashboard.',
      'Production deployments must NOT set LOADBENCH_DISABLE_AUTH=true.',
    ],
  },
  {
    title: '3. Set admin operators',
    body: 'LOADBENCH_ADMIN_EMAILS is a comma-separated list of Clerk-account emails who can reach the operator pages (entitlements, model validation, deployment check, beta package).',
    bullets: [
      'Add each operator email, lowercase, comma-separated.',
      'Leave blank to lock all admin pages until you are ready.',
      'Emails are matched against the user\'s primary Clerk email.',
    ],
  },
  {
    title: '4. Deploy the external ballistics service (.NET)',
    body: 'The Next.js app does not compute downrange ballistics in-process. Deploy services/ballistics-engine as a separate ASP.NET Core service.',
    bullets: [
      'See services/ballistics-engine/README.md for a Dockerfile + hosting notes.',
      'Set BALLISTICS_ENGINE_URL in Vercel to its HTTPS URL.',
      'Leave BALLISTICS_ENGINE_URL unset to keep the /ballistics page in setup-help mode without crashing.',
    ],
  },
  {
    title: '5. Optional: BigCommerce premium checkout',
    body: 'If you sell premium pressure-engine access, configure BigCommerce. Otherwise grant access manually from /admin/entitlements.',
    bullets: [
      'Set BIGCOMMERCE_STORE_HASH, BIGCOMMERCE_API_TOKEN, BIGCOMMERCE_CHANNEL_ID, and BIGCOMMERCE_WEBHOOK_SECRET together — partial config silently breaks webhooks.',
      'Keep STRIPE_* keys unset unless you are migrating from a Stripe deployment.',
    ],
  },
  {
    title: '6. Set the public app URL',
    body: 'NEXT_PUBLIC_APP_URL is used for branding, email subjects, and redirects.',
    bullets: [
      'Set it to the canonical Vercel URL or your custom domain.',
      'Keep the protocol (https://...).',
    ],
  },
  {
    title: '7. Verify',
    body: 'After deploying, walk through these pages to confirm everything is wired correctly.',
    bullets: [
      '/api/health → returns { status: "ok" }.',
      '/admin/deployment-check (operator) → env-var presence, DB probe, ballistics /health probe.',
      '/onboarding → workspace setup walkthrough should render.',
      '/safety → required reading; renders for every user.',
    ],
  },
];

export default async function DeploymentSettingsPage() {
  const admin = await getAdminContext();

  return (
    <>
      <Topbar
        title="Deployment guide"
        actions={
          admin.isAdmin ? (
            <Link
              href="/admin/deployment-check"
              className="text-[12px] text-accent hover:text-accent-hover"
            >
              Open operator diagnostics →
            </Link>
          ) : (
            <Badge tone="neutral">Reference</Badge>
          )
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Production deployment overview"
            description="LoadBench Pro is a Next.js 15 app deployed on Vercel, backed by Neon Postgres and Clerk. The ballistics engine is a separate .NET service. Pressure prediction is permanently disabled — no setting on this page can enable it."
          />
          <CardBody>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Follow these steps once per environment (production, staging, preview).
              Each step lists the variables you must set in Vercel.
              {admin.isAdmin
                ? ' As an operator, the diagnostics page can verify each variable without exposing secret values.'
                : ' Ask your operator for the diagnostics page if you need to confirm a variable is set.'}
            </p>
          </CardBody>
        </Card>

        {STEPS.map((step, i) => (
          <Card key={i}>
            <CardHeader title={step.title} description={step.body} />
            <CardBody>
              <ul className="list-disc pl-5 text-[13px] text-text-muted space-y-1.5 leading-relaxed">
                {step.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}

        <Card>
          <CardHeader
            title="Local development quick-start"
            description="Run the app on your workstation."
          />
          <CardBody>
            <pre className="text-[12px] text-text-muted leading-relaxed bg-bg-inset rounded p-3 overflow-x-auto">
{`cp .env.example .env.local
# fill in DATABASE_URL, DIRECT_URL, Clerk keys
npm install
npx prisma migrate deploy
npm run dev`}
            </pre>
            <p className="mt-3 text-[12px] text-text-muted">
              The /ballistics page will show a setup card until you also run{' '}
              <code className="text-accent">cd services/ballistics-engine && dotnet run</code>{' '}
              and set <code className="text-accent">BALLISTICS_ENGINE_URL=http://localhost:5080</code>.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Safety posture"
            description="Pressure prediction is permanently disabled in the application code itself. No environment variable, entitlement, or admin override re-enables it."
          />
          <CardBody>
            <p className="text-[12px] text-text-muted leading-relaxed">
              The premium pressure-engine UI is a validation workspace only —
              it records data completeness and (for admin-controlled validation
              runs) a velocity-only delta against user-entered reference data.
              It never returns PSI, charge recommendations, or safe/unsafe verdicts.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
