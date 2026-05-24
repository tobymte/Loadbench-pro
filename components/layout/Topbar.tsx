import { MobileNav } from '@/components/layout/MobileNav';

export function Topbar({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-bg-surface flex items-center gap-3 px-4 sm:px-6 print:hidden">
      <MobileNav />
      <h1 className="text-base font-semibold text-text tracking-tight truncate">
        {title}
      </h1>
      <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
        {actions}
      </div>
    </header>
  );
}
