import Link from 'next/link';

export function SafetyBanner() {
  return (
    <div className="border-b border-danger/40 bg-danger-subtle text-text">
      <div className="px-6 py-2 flex items-center gap-3 text-[12px]">
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-danger text-bg font-bold text-[10px]"
        >
          !
        </span>
        <span className="text-text-muted">
          LoadBench Pro is a personal reloading notebook. It does not suggest charges
          and cannot judge the safety of a load.
        </span>
        <Link
          href="/safety"
          className="ml-auto text-accent hover:text-accent-hover underline-offset-2 hover:underline"
        >
          Read safety policy →
        </Link>
      </div>
    </div>
  );
}
