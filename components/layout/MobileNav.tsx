'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Mobile navigation drawer. Surfaces the same nav structure as the desktop
// sidebar but as a slide-in panel triggered by a button in the mobile topbar.
// Keeps desktop layout untouched: this component renders nothing >= md.

type Item = { href: string; label: string; hint?: string; exact?: boolean };
type Group = { group: string; items: Item[] };

const NAV: Group[] = [
  {
    group: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/onboarding', label: 'Onboarding' },
      { href: '/notebook', label: 'Notebook & printables' },
    ],
  },
  {
    group: 'Library',
    items: [
      { href: '/sources', label: 'Sources' },
      { href: '/cartridges', label: 'Cartridges' },
      { href: '/components', label: 'Components · inventory' },
      { href: '/rifles', label: 'Rifles' },
      { href: '/loads', label: 'Loads' },
      { href: '/sessions', label: 'Range sessions' },
    ],
  },
  {
    group: 'Tools',
    items: [
      { href: '/data-import', label: 'Guided data import' },
      { href: '/compare', label: 'Compare loads' },
      { href: '/ballistics', label: 'Ballistics estimate' },
      { href: '/chrono-import', label: 'Chrono import' },
      { href: '/published-data-review', label: 'Published-data review' },
      { href: '/data-quality', label: 'Data quality review' },
      { href: '/solver-inputs', label: 'Solver inputs' },
    ],
  },
  {
    group: 'Pressure engine',
    items: [
      { href: '/pressure-engine', label: 'Overview', exact: true },
      { href: '/pressure-engine/setup', label: 'Setup wizard' },
      { href: '/pressure-engine/new', label: 'New run' },
      { href: '/pressure-modeling', label: 'Test bench' },
      { href: '/simulation-sandbox', label: 'Simulation sandbox' },
    ],
  },
  {
    group: 'Account',
    items: [
      { href: '/data-tools', label: 'Data tools · export' },
      { href: '/settings', label: 'Settings' },
      { href: '/settings/deployment', label: 'Deployment guide' },
      { href: '/safety', label: 'Safety policy' },
      { href: '/beta', label: 'Beta package' },
      { href: '/beta/feedback', label: 'Beta feedback' },
    ],
  },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '/';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded border border-border bg-bg-surface text-text"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        data-testid="mobile-nav-open"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-bg-surface border-r border-border flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-sm font-semibold text-text">
                LoadBench <span className="text-accent">Pro</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="h-8 w-8 rounded border border-border text-text-muted hover:text-text"
              >
                ×
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
              {NAV.map((g) => (
                <div key={g.group} className="mb-4">
                  <div className="px-4 mb-1 text-[10px] uppercase tracking-wider text-text-faint font-medium">
                    {g.group}
                  </div>
                  <ul>
                    {g.items.map((item) => {
                      const active = item.exact
                        ? pathname === item.href
                        : pathname === item.href ||
                          (item.href !== '/' && pathname.startsWith(item.href + '/'));
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              'block px-4 py-2 text-sm border-l-2',
                              active
                                ? 'text-text bg-bg-alt border-accent'
                                : 'text-text-muted hover:text-text border-transparent hover:bg-bg-alt/60',
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="px-4 py-3 border-t border-border text-[11px] text-text-faint">
              Notebook · not a load engine.
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
