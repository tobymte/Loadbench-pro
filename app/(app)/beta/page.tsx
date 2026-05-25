import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// /beta
//
// Beta-tester landing page. Lists known limitations, the safety disclaimer
// the tester must acknowledge, the bug-report template, and the test
// scenarios LoadBench Pro wants feedback on. Visible to every signed-in user
// — testers do not need admin access.

export const dynamic = 'force-dynamic';

const LIMITATIONS: Array<{ title: string; body: string }> = [
  {
    title: 'Pressure prediction is permanently disabled',
    body: 'No PSI estimate, no charge recommendation, no safe/unsafe verdict. The premium pressure-engine workspace is a validation surface only — it records data completeness and a velocity-only delta.',
  },
  {
    title: 'External ballistics ships with a placeholder calculator',
    body: 'Until BallisticCalculator (LGPL-2.1) is wired into services/ballistics-engine, the /ballistics page returns clearly-marked placeholder output. Trajectories are physically plausible but not production-quality.',
  },
  {
    title: 'Workspace membership is auto-created',
    body: 'On first sign-in the system creates a personal workspace and makes you the owner. Multi-user workspace invites are not exposed in the UI yet.',
  },
  {
    title: 'Settings unit selectors are local-only',
    body: 'Unit preferences are saved to your browser, not the database. Switching browsers resets them.',
  },
  {
    title: 'Some admin imports are template-only',
    body: 'The model validation harness ships with downloadable CSV templates and a UI form, but bulk CSV import is not wired up yet — admins transcribe rows by hand for now.',
  },
];

const TEST_SCENARIOS: Array<{ title: string; steps: string[] }> = [
  {
    title: 'Onboarding & first load',
    steps: [
      'Sign up with a fresh email.',
      'Walk through /onboarding step by step.',
      'Add a source, a cartridge, a bullet, a powder, and a rifle.',
      'Record a load at the published starting charge with the safety acknowledgement checked.',
      'Try to record a load that exceeds the source\'s published maximum — verify the save is refused.',
    ],
  },
  {
    title: 'Range & chrono import',
    steps: [
      'Log a range session against your load.',
      'Open /chrono-import and paste a chronograph CSV.',
      'Verify the session shows correct shot count, average velocity, ES, and SD.',
    ],
  },
  {
    title: 'Published-data review',
    steps: [
      'Open /published-data-review.',
      'Stage a row by hand (or via /data-import).',
      'Verify a row and then attach it as the citation for a new load.',
    ],
  },
  {
    title: 'Mobile usability',
    steps: [
      'Open the app on a phone (or browser dev-tools "Pixel 5" preset).',
      'Open the hamburger menu from the topbar; navigate between Dashboard, Loads, and Sessions.',
      'Try the data-import wizard with a small CSV paste.',
      'Make sure no form is unusable (overflows, hidden submit, broken keyboard).',
    ],
  },
  {
    title: 'Backup & export',
    steps: [
      'Open /data-tools and download the JSON snapshot.',
      'Download each CSV export and open in a spreadsheet.',
      'Verify your data only — no other workspaces appear.',
    ],
  },
  {
    title: 'Ballistics engine',
    steps: [
      'Without BALLISTICS_ENGINE_URL set, /ballistics shows setup help (not a crash).',
      'With the engine running, open /ballistics — see the engine badge in the topbar.',
      'Send a request, verify the disclaimer is present and the engine identifier matches.',
    ],
  },
];

const RELEASE_CHECKLIST = [
  'All migrations applied to the production database (`prisma migrate deploy`).',
  '`prisma generate` ran during the build (handled by `npm run build`).',
  'All required environment variables set in the production environment (see /settings/deployment and /admin/deployment-check).',
  'Clerk publishable and secret keys set; LOADBENCH_DISABLE_AUTH is unset or "false".',
  'BALLISTICS_ENGINE_URL set to the deployed ballistics service or intentionally unset.',
  'LOADBENCH_ADMIN_EMAILS populated with the operator email list.',
  'BigCommerce variables either all set or all unset.',
  '/api/health returns 200; /api/ballistics/health returns 200 (or 503 if intentionally unconfigured).',
  'Smoke-test: sign up → onboarding → record a load → log a session.',
];

export default function BetaPage() {
  return (
    <>
      <Topbar
        title="Beta tester package"
        actions={
          <>
            <Badge tone="accent">Beta</Badge>
            <Link href="/beta/feedback">
              <Button size="sm">Submit feedback</Button>
            </Link>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Found something? File a report."
            description="The in-app feedback tracker accepts bug reports, usability feedback, feature requests, data and safety concerns, performance issues, mobile issues, and deployment/login problems."
            actions={
              <Link href="/beta/feedback">
                <Button size="sm">Open feedback form →</Button>
              </Link>
            }
          />
          <CardBody>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Each report is stored in the beta issue tracker and triaged by an
              operator. You can see the status of your past reports below the
              form once you have one open.
            </p>
          </CardBody>
        </Card>

        <Card className="border-danger/40">
          <CardHeader
            title="Safety disclaimer — please read"
            description="LoadBench Pro is a notebook. It is not a load engine. It does not predict pressure, recommend charges, or rate safety. You are responsible for verifying every load against the current published manual, the manufacturer's data, and your own judgment."
            actions={
              <Link href="/safety">
                <Button size="sm" variant="secondary">
                  Read full safety policy
                </Button>
              </Link>
            }
          />
          <CardBody>
            <p className="text-[12px] text-text-muted leading-relaxed">
              By participating in the beta you acknowledge: (1) this software
              is under active development; (2) data may be lost between beta
              builds; (3) you will not rely on LoadBench Pro for any safety
              judgment; (4) you will start at the published starting charge,
              work up cautiously, watch for pressure signs, and stop at or
              below the published maximum on the source you cite.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Known limitations"
            description="What does NOT work yet — please don't file bugs for these."
          />
          <CardBody className="!p-0">
            <ul className="divide-y divide-border">
              {LIMITATIONS.map((l) => (
                <li key={l.title} className="px-5 py-3">
                  <div className="text-sm font-medium text-text">{l.title}</div>
                  <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                    {l.body}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Test scenarios"
            description="Please walk through these and report anything that looks wrong, confusing, or unsafe."
          />
          <CardBody className="!p-0">
            <ul className="divide-y divide-border">
              {TEST_SCENARIOS.map((s) => (
                <li key={s.title} className="px-5 py-3">
                  <div className="text-sm font-medium text-text mb-1">{s.title}</div>
                  <ol className="list-decimal pl-5 text-[12px] text-text-muted space-y-0.5 leading-relaxed">
                    {s.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Bug report template"
            description="Copy this into the channel your operator gave you. The more context, the faster a fix lands."
          />
          <CardBody>
            <pre className="text-[12px] text-text-muted leading-relaxed bg-bg-inset rounded p-3 overflow-x-auto whitespace-pre-wrap">
{`### Summary
<one sentence>

### What I did
1.
2.
3.

### What I expected
<one sentence>

### What happened
<one sentence + screenshot link if you have one>

### Severity
[ ] Safety-relevant (incorrect refusal, missing acknowledgement, etc.)
[ ] Data loss
[ ] Functional bug
[ ] Cosmetic / UX

### Environment
- Browser / OS:
- Workspace size (rough load count):
- Build / commit hash (footer, if shown):

### Anything else?
`}
            </pre>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Tester onboarding"
            description="Get up and running in five minutes."
          />
          <CardBody>
            <ol className="list-decimal pl-5 text-[12px] text-text-muted space-y-1 leading-relaxed">
              <li>
                Sign up at <code className="text-accent">/sign-up</code> with your tester email.
              </li>
              <li>
                Open the dashboard — you should see the welcome banner.
              </li>
              <li>
                Click <strong>Start onboarding</strong> and work through every step.
              </li>
              <li>
                Read <Link href="/safety" className="text-accent">/safety</Link> in full.
              </li>
              <li>
                Walk through the test scenarios above. File bugs with the template.
              </li>
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Release checklist (operator)"
            description="Run through this before turning the beta link over to new testers."
          />
          <CardBody>
            <ul className="list-none text-[12px] text-text-muted space-y-1.5">
              {RELEASE_CHECKLIST.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="h-4 w-4 mt-0.5 rounded-sm border border-border bg-bg-inset shrink-0"
                  />
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Useful links"
            description="Quick jumps for testers and operators."
          />
          <CardBody className="flex flex-wrap gap-2">
            <Link href="/beta/feedback"><Button>Submit feedback</Button></Link>
            <Link href="/onboarding"><Button variant="secondary">Onboarding</Button></Link>
            <Link href="/safety"><Button variant="secondary">Safety policy</Button></Link>
            <Link href="/data-tools"><Button variant="secondary">Export & backup</Button></Link>
            <Link href="/settings/deployment"><Button variant="secondary">Deployment guide</Button></Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
