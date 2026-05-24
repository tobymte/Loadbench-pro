'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV: Array<{
  group: string;
  items: Array<{ href: string; label: string; hint?: string; title?: string; exact?: boolean }>;
}> = [
  {
    group: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard', hint: 'Start here' },
      { href: '/notebook', label: 'Notebook & printables', title: 'Printable load and component cards' },
    ],
  },
  {
    group: 'Library',
    items: [
      { href: '/sources', label: 'Sources', hint: 'Citations', title: 'Published references you cite when recording a load' },
      { href: '/cartridges', label: 'Cartridges' },
      { href: '/components', label: 'Components · inventory', title: 'Bullets, powders, primers, cases by lot' },
      { href: '/rifles', label: 'Rifles' },
      { href: '/loads', label: 'Loads' },
      { href: '/sessions', label: 'Range sessions' },
    ],
  },
  {
    group: 'Tools',
    items: [
      { href: '/data-import', label: 'Guided data import', hint: 'Start here', title: 'One place to paste/import core data and route it to the right workflow' },
      { href: '/compare', label: 'Compare loads', title: 'Filterable side-by-side comparison of observed session data' },
      { href: '/ballistics', label: 'Ballistics estimate', title: 'Educational G1 trajectory from your inputs' },
      { href: '/chrono-import', label: 'Chrono import', title: 'Paste a chronograph CSV into a new range session' },
      { href: '/published-data-review', label: 'Published-data review', hint: 'User-verified', title: 'Stage and verify published rows before citing them on a load' },
      { href: '/solver-inputs', label: 'Solver inputs', hint: 'Data capture', title: 'Capture data inputs used by the pressure-engine workspace' },
    ],
  },
  {
    group: 'Pressure engine',
    items: [
      { href: '/pressure-engine', label: 'Overview', hint: 'Premium', title: 'Controlled validation workspace — pressure prediction disabled', exact: true },
      { href: '/pressure-engine/setup', label: 'Setup wizard', hint: 'Setup', title: 'Readiness checklist before starting a validation run' },
      { href: '/pressure-engine/new', label: 'New run', hint: 'Builder', title: 'Run builder — non-operational, no PSI or charge advice' },
      { href: '/pressure-modeling', label: 'Test bench', hint: 'Experimental', title: 'Pressure modeling validation infrastructure' },
      { href: '/simulation-sandbox', label: 'Simulation sandbox', hint: 'Validation-only', title: 'Scenario sandbox — produces no pressure or charge output' },
    ],
  },
  {
    group: 'Account',
    items: [
      { href: '/data-tools', label: 'Data tools', title: 'Workspace export and bulk operations' },
      { href: '/settings', label: 'Settings' },
      { href: '/safety', label: 'Safety policy', hint: 'Required', title: 'Required reading before recording any load' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { href: '/admin/entitlements', label: 'Entitlements', hint: 'Operator', title: 'Manage premium entitlements per workspace' },
      { href: '/admin/model-validation', label: 'Model validation', hint: 'Operator', title: 'Validation harness for the internal ballistics model adapter — pressure prediction disabled' },
    ],
  },
];

function Logo() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-label="LoadBench Pro"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? '/';

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border bg-bg-surface print:hidden">
      <div className="px-5 py-5 border-b border-border flex items-center gap-2.5 text-accent">
        <Logo />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-text tracking-tight">
            LoadBench
          </div>
          <div className="text-xs text-text-muted">Pro · Notebook</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3">
        {NAV.map((group) => (
          <div key={group.group} className="mb-5">
            <div className="px-5 mb-1.5 text-[10px] uppercase tracking-wider text-text-faint font-medium">
              {group.group}
            </div>
            <ul>
              {group.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href + '/'));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.title ?? item.label}
                      data-testid={`nav-${item.href}`}
                      className={cn(
                        'flex items-center justify-between px-5 py-1.5 text-sm border-l-2',
                        active
                          ? 'text-text bg-bg-alt border-accent'
                          : 'text-text-muted hover:text-text border-transparent hover:bg-bg-alt/60',
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.hint && (
                        <span className="text-[10px] text-accent shrink-0 ml-2">
                          {item.hint}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-border text-[11px] text-text-faint">
        <div className="font-medium text-text-muted mb-1">Not a load engine.</div>
        Records what you do. Cites what you read. Suggests nothing.
      </div>
    </aside>
  );
}
