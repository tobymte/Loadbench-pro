import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <span className="text-sm font-semibold tracking-tight">
            LoadBench <span className="text-accent">Pro</span>
          </span>
          <nav className="ml-auto flex items-center gap-5 text-xs text-text-muted">
            <Link href="/safety" className="hover:text-text">
              Safety policy
            </Link>
            <Link href="/dashboard">
              <Button size="sm" variant="secondary">
                Open notebook →
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-[1.2fr_1fr] gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-accent border border-accent/30 bg-accent-subtle rounded px-2 py-1 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Reloading notebook · not a load engine
            </div>
            <h1 className="text-xl md:text-2xl font-semibold text-text leading-tight tracking-tight">
              Record what you load.
              <br />
              Cite what you read.
              <br />
              <span className="text-text-muted">
                Make every charge a deliberate decision.
              </span>
            </h1>
            <p className="mt-6 text-sm text-text-muted leading-relaxed max-w-xl">
              LoadBench Pro is a safety-first reloading notebook for handloaders.
              It tracks cartridges, components, loads, and range sessions —
              and ties every charge to a published reference source you cite
              yourself. It will never tell you what to load, and it will
              refuse to save any charge above the published maximum on the
              source you cited.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Link href="/dashboard">
                <Button>Open the notebook</Button>
              </Link>
              <Link href="/safety">
                <Button variant="secondary">Read safety policy</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg-surface p-6">
            <div className="text-[11px] uppercase tracking-wider text-text-faint mb-4">
              What LoadBench Pro is — and is not
            </div>
            <dl className="space-y-4 text-sm">
              <div className="grid grid-cols-[80px_1fr] gap-3 items-start">
                <dt className="text-success text-xs uppercase tracking-wider pt-0.5">
                  Is
                </dt>
                <dd className="text-text-muted">
                  A notebook for recording loads, components, and range
                  results, with citations to published reference sources.
                </dd>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-3 items-start">
                <dt className="text-success text-xs uppercase tracking-wider pt-0.5">
                  Is
                </dt>
                <dd className="text-text-muted">
                  A validation layer that blocks charge-bearing saves without a
                  cited source and acknowledgement.
                </dd>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-3 items-start">
                <dt className="text-danger text-xs uppercase tracking-wider pt-0.5">
                  Is not
                </dt>
                <dd className="text-text-muted">
                  A load-development engine. It does not recommend, predict, or
                  &quot;correct&quot; charges.
                </dd>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-3 items-start">
                <dt className="text-danger text-xs uppercase tracking-wider pt-0.5">
                  Is not
                </dt>
                <dd className="text-text-muted">
                  A substitute for the published manual, the ammunition
                  manufacturer&rsquo;s data, or your own judgment.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center text-[11px] text-text-faint">
          LoadBench Pro starter scaffold · See
          <Link href="/safety" className="text-accent ml-1 hover:text-accent-hover">
            Safety policy
          </Link>
          .
        </div>
      </footer>
    </main>
  );
}
