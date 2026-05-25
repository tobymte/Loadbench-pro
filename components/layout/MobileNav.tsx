'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Mobile navigation drawer. Mirrors the desktop sidebar structure: a small
// number of collapsible sections, with the Admin section gated behind the
// `isAdmin` prop so non-admin users never see operator routes.

type Item = { href: string; label: string; hint?: string; exact?: boolean };
type Section = {
  key: string;
  group: string;
  defaultOpen?: boolean;
  adminOnly?: boolean;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    key: 'home',
    group: 'Home',
    defaultOpen: true,
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/onboarding', label: 'Get started' },
    ],
  },
  {
    key: 'notebook',
    group: 'Notebook',
    defaultOpen: true,
    items: [
      { href: '/loads', label: 'Loads' },
      { href: '/sessions', label: 'Range sessions' },
      { href: '/cartridges', label: 'Cartridges' },
      { href: '/components', label: 'Components & inventory' },
      { href: '/rifles', label: 'Rifles' },
      { href: '/sources', label: 'Sources' },
      { href: '/notebook', label: 'Printables' },
    ],
  },
  {
    key: 'import',
    group: 'Import & Review',
    items: [
      { href: '/data-import', label: 'Guided import' },
      { href: '/chrono-import', label: 'Chronograph CSV' },
      { href: '/published-data-review', label: 'Published-data review' },
      { href: '/cip-reference', label: 'Reference library' },
      { href: '/data-quality', label: 'Data quality' },
    ],
  },
  {
    key: 'tools',
    group: 'Tools',
    items: [
      { href: '/compare', label: 'Compare loads' },
      { href: '/ballistics', label: 'Ballistics estimate' },
      { href: '/solver-inputs', label: 'Pressure data inputs' },
      { href: '/data-tools', label: 'Export & bulk tools' },
    ],
  },
  {
    key: 'pressure',
    group: 'Pressure Lab',
    items: [
      { href: '/pressure-engine', label: 'Overview', exact: true },
      { href: '/pressure-engine/setup', label: 'Setup wizard' },
      { href: '/pressure-engine/new', label: 'New run' },
      { href: '/pressure-modeling', label: 'Test bench' },
      { href: '/simulation-sandbox', label: 'Validation sandbox' },
    ],
  },
  {
    key: 'account',
    group: 'Account & Help',
    items: [
      { href: '/settings', label: 'Settings' },
      { href: '/safety', label: 'Safety policy' },
      { href: '/beta', label: 'Beta program' },
      { href: '/beta/feedback', label: 'Send feedback' },
    ],
  },
  {
    key: 'admin',
    group: 'Admin & Operator',
    adminOnly: true,
    items: [
      { href: '/admin/deployment-check', label: 'Deployment check' },
      { href: '/settings/deployment', label: 'Deployment guide' },
      { href: '/admin/entitlements', label: 'Entitlements' },
      { href: '/admin/model-validation', label: 'Model validation', exact: true },
      { href: '/admin/model-validation/templates', label: 'Validation templates' },
      { href: '/admin/model-validation/reporting', label: 'Validation reporting' },
      { href: '/admin/shooters-world-cip', label: 'SW/CIP admin' },
      { href: '/admin/beta', label: 'Beta release' },
      { href: '/admin/beta/issues', label: 'Beta issues' },
    ],
  },
];

function isItemActive(pathname: string, item: Item) {
  if (item.exact) return pathname === item.href;
  return (
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href + '/'))
  );
}

function sectionContainsActive(pathname: string, section: Section) {
  return section.items.some((i) => isItemActive(pathname, i));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
      className={cn('transition-transform shrink-0', open ? 'rotate-90' : '')}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '/';
  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of visibleSections) {
      init[s.key] = s.defaultOpen ?? false;
    }
    return init;
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setOpenMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const s of visibleSections) {
        if (sectionContainsActive(pathname, s) && !next[s.key]) {
          next[s.key] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {visibleSections.map((section) => {
                const isOpen = !!openMap[section.key];
                const hasActive = sectionContainsActive(pathname, section);
                return (
                  <div key={section.key} className="mb-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMap((m) => ({
                          ...m,
                          [section.key]: !m[section.key],
                        }))
                      }
                      className={cn(
                        'w-full flex items-center gap-2 px-4 py-1.5 text-[11px] uppercase tracking-wider font-medium',
                        hasActive ? 'text-text' : 'text-text-faint',
                      )}
                      aria-expanded={isOpen}
                    >
                      <Chevron open={isOpen} />
                      <span className="flex-1 text-left">{section.group}</span>
                      {section.adminOnly && (
                        <span className="text-[9px] text-accent normal-case tracking-normal">
                          admin
                        </span>
                      )}
                    </button>
                    {isOpen && (
                      <ul>
                        {section.items.map((item) => {
                          const active = isItemActive(pathname, item);
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                className={cn(
                                  'block pl-9 pr-4 py-2 text-sm border-l-2',
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
                    )}
                  </div>
                );
              })}
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
