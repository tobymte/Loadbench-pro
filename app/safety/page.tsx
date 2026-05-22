import Link from 'next/link';
import { SafetyBanner } from '@/components/layout/SafetyBanner';

export default function SafetyPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <SafetyBanner />
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-text"
          >
            LoadBench <span className="text-accent">Pro</span>
          </Link>
          <Link
            href="/dashboard"
            className="ml-auto text-xs text-text-muted hover:text-text"
          >
            Open notebook →
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 prose prose-invert text-text">
        <h1 className="text-xl font-semibold tracking-tight mb-2">
          Safety policy
        </h1>
        <p className="text-xs uppercase tracking-wider text-text-faint mb-6">
          Read this before recording any load.
        </p>

        <Section title="LoadBench Pro is a notebook, not a load engine.">
          <p>
            LoadBench Pro records what <em>you</em> chose to load and the
            published source <em>you</em> cited. It does not develop loads,
            recommend charges, predict pressure, or correct entries that look
            wrong. It will refuse to save a charge weight that exceeds the
            published maximum recorded on the source you cited, but{' '}
            <strong>
              absence of a refusal is not evidence the load is safe.
            </strong>
          </p>
        </Section>

        <Section title="Your responsibilities">
          <ul>
            <li>
              Use only data from current, published reference sources you have
              read yourself — manufacturer manuals, powder-maker load data, or
              SAAMI/CIP publications.
            </li>
            <li>
              Verify the bullet, powder, primer, case, and cartridge in the
              source exactly match what you are loading.
            </li>
            <li>
              Always start at the published <strong>starting</strong> load and
              work up in small increments, watching for pressure signs before
              each step.
            </li>
            <li>
              Never exceed the published maximum charge. Substitutions are not
              equivalents.
            </li>
            <li>
              Keep your own range notes. Software is not a substitute for
              observation.
            </li>
          </ul>
        </Section>

        <Section title="What LoadBench Pro will never do">
          <ul>
            <li>Suggest a starting or maximum charge.</li>
            <li>Estimate pressure or velocity.</li>
            <li>
              Offer a &quot;corrected&quot; value when a charge is rejected.
            </li>
            <li>
              Replace your judgment, your manuals, or your gunsmith&rsquo;s
              advice.
            </li>
          </ul>
        </Section>

        <Section title="What LoadBench Pro does enforce">
          <ul>
            <li>
              <strong>Source-required for charges.</strong> Any record with a
              non-empty charge weight must cite a published Source.
            </li>
            <li>
              <strong>Acknowledgement required for charges.</strong> You must
              explicitly check the safety acknowledgement on every charge-bearing
              save.
            </li>
            <li>
              <strong>Charge ≤ published max.</strong> If the cited Source
              records a published maximum charge, LoadBench Pro will not save a
              charge greater than that value.
            </li>
            <li>
              <strong>Audit trail.</strong> Every create, update, delete, export,
              and print is logged in the workspace audit log.
            </li>
          </ul>
        </Section>

        <Section title="No warranty">
          <p>
            LoadBench Pro is provided <strong>as-is</strong>, with no warranty
            of any kind. The authors are not responsible for damage, injury, or
            death resulting from any load recorded in or derived from this
            software. Reloading is inherently dangerous. If you are not
            qualified to evaluate a load yourself, do not load it.
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-text mb-3">{title}</h2>
      <div className="text-sm text-text-muted leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-text [&_em]:text-text">
        {children}
      </div>
    </section>
  );
}
