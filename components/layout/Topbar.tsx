export function Topbar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-bg-surface flex items-center px-6 print:hidden">
      <h1 className="text-base font-semibold text-text tracking-tight">{title}</h1>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  );
}
