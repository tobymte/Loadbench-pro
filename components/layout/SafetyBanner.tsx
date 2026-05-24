import Link from 'next/link';

export function SafetyBanner() {
  return (
    <div className="border-b border-danger/40 bg-danger-subtle text-text print:hidden" data-safety-banner>
      <div className="px-4 sm:px-6 py-2 flex items-start sm:items-center gap-3 text-[12px]">
        <span
          aria-hidden
          className="inline-flex h-4 w-4 shrink-0 mt-0.5 sm:mt-0 items-center justify-center rounded-full bg-danger text-bg font-bold text-[10px]"
        >
          !
        </span>
        <span className="text-text-muted leading-tight">
          <strong className="text-text font-semibold">Notebook · not a load engine.</strong>{' '}
          <span className="hidden sm:inline">
            LoadBench Pro records what you load and the source you cite. It
            will never suggest a charge or rate the safety of a load.
          </span>
          <span className="sm:hidden">Records loads. Never recommends.</span>
        </span>
        <Link
          href="/safety"
          className="ml-auto text-accent hover:text-accent-hover underline-offset-2 hover:underline whitespace-nowrap"
        >
          <span className="hidden sm:inline">Read safety policy →</span>
          <span className="sm:hidden">Safety →</span>
        </Link>
      </div>
    </div>
  );
}
