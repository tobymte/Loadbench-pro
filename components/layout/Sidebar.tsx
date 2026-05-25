'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Navigation model: a small number of high-level sections, each containing a
// flat list of routes. Sections are collapsible so the sidebar stays scannable
// at a glance. The Admin section is only rendered when `isAdmin` is true.

type NavItem = {
  href: string;
  label: string;
  hint?: string;
  title?: string;
  exact?: boolean;
};

type NavSection = {
  key: string;
  group: string;
  // Whether this section is expanded by default on first load. Sections that
  // contain the active route always open regardless of this default.
  defaultOpen?: boolean;
  // Restrict this section to admins (operator/admin routes).
  adminOnly?: boolean;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    key: 'home',
    group: 'Home',
    defaultOpen: true,
    items: [
      { href: '/dashboard', label: 'Dashboard', hint: 'Start here' },
      { href: '/onboarding', label: 'Get started', title: 'First-login setup walkthrough' },
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
      { href: '/components', label: 'Components & inventory', title: 'Bullets, powders, primers, cases by lot' },
      { href: '/rifles', label: 'Rifles' },
      { href: '/sources', label: 'Sources', title: 'Published references you cite when recording a load' },
      { href: '/notebook', label: 'Printables', title: 'Printable load and component cards' },
    ],
  },
  {
    key: 'import',
    group: 'Import & Review',
    defaultOpen: false,
    items: [
      { href: '/data-import', label: 'Guided import', hint: 'Start here', title: 'One place to paste/import core data and route it to the right workflow' },
      { href: '/chrono-import', label: 'Chronograph CSV', title: 'Paste a chronograph CSV into a new range session' },
      { href: '/published-data-review', label: 'Published-data review', title: 'Stage and verify published rows before citing them on a load' },
      { href: '/cip-reference', label: 'Reference library', title: 'Verified Shooters World / CIP reference metadata — pressure prediction disabled' },
      { href: '/data-quality', label: 'Data quality', title: 'Surface missing fields, unverified rows, and incomplete references' },
    ],
  },
  {
    key: 'tools',
    group: 'Tools',
    defaultOpen: false,
    items: [
      { href: '/compare', label: 'Compare loads', title: 'Filterable side-by-side comparison of observed session data' },
      { href: '/ballistics', label: 'Ballistics estimate', title: 'Educational G1 trajectory from your inputs' },
      { href: '/solver-inputs', label: 'Pressure data inputs', title: 'Capture data inputs used by the pressure-engine workspace' },
      { href: '/data-tools', label: 'Export & bulk tools', title: 'Workspace export and bulk operations' },
    ],
  },
  {
    key: 'pressure',
    group: 'Pressure Lab',
    defaultOpen: false,
    items: [
      { href: '/pressure-engine', label: 'Overview', hint: 'Premium', title: 'Controlled validation workspace — pressure prediction disabled', exact: true },
      { href: '/pressure-engine/setup', label: 'Setup wizard', title: 'Readiness checklist before starting a validation run' },
      { href: '/pressure-engine/new', label: 'New run', title: 'Run builder — non-operational, no PSI or charge advice' },
      { href: '/pressure-modeling', label: 'Test bench', title: 'Pressure modeling validation infrastructure' },
      { href: '/simulation-sandbox', label: 'Validation sandbox', title: 'Scenario sandbox — produces no pressure or charge output' },
    ],
  },
  {
    key: 'account',
    group: 'Account & Help',
    defaultOpen: false,
    items: [
      { href: '/settings', label: 'Settings' },
      { href: '/safety', label: 'Safety policy', hint: 'Required', title: 'Required reading before recording any load' },
      { href: '/beta', label: 'Beta program', title: 'Beta-tester onboarding, limitations, and bug-report template' },
      { href: '/beta/feedback', label: 'Send feedback', title: 'Submit beta bug reports, usability feedback, feature requests' },
    ],
  },
  {
    key: 'admin',
    group: 'Admin & Operator',
    defaultOpen: false,
    adminOnly: true,
    items: [
      { href: '/admin/deployment-check', label: 'Deployment check', title: 'Env-var diagnostics and DB / ballistics-engine liveness probes' },
      { href: '/settings/deployment', label: 'Deployment guide', title: 'Production setup notes for operators' },
      { href: '/admin/entitlements', label: 'Entitlements', title: 'Manage premium entitlements per workspace' },
      { href: '/admin/model-validation', label: 'Model validation', title: 'Validation harness for the internal ballistics model adapter — pressure prediction disabled', exact: true },
      { href: '/admin/model-validation/templates', label: 'Validation templates', title: 'Downloadable CSV templates for safe validation dataset entry' },
      { href: '/admin/model-validation/reporting', label: 'Validation reporting', title: 'Aggregate stats, run history, adapter status, guardrail telemetry' },
      { href: '/admin/shooters-world-cip', label: 'SW/CIP admin', title: 'Admin entry for Shooters World / CIP reference rows — pressure prediction disabled' },
      { href: '/admin/beta', label: 'Beta release', title: 'Beta release readiness, blockers, and tester links' },
      { href: '/admin/beta/issues', label: 'Beta issues', title: 'Triage user-submitted beta feedback and issues' },
    ],
  },
];

function isItemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return (
    pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href + '/'))
  );
}

function sectionContainsActive(pathname: string, section: NavSection) {
  return section.items.some((i) => isItemActive(pathname, i));
}

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

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname() ?? '/';
  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of visibleSections) {
      init[s.key] = s.defaultOpen ?? false;
    }
    return init;
  });

  // Whenever the active route changes, force-open the section that contains
  // it. We do not collapse other sections — user-toggled state is preserved.
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
        {visibleSections.map((section) => {
          const open = !!openMap[section.key];
          const hasActive = sectionContainsActive(pathname, section);
          return (
            <div key={section.key} className="mb-1.5">
              <button
                type="button"
                onClick={() =>
                  setOpenMap((m) => ({ ...m, [section.key]: !m[section.key] }))
                }
                className={cn(
                  'w-full flex items-center gap-2 px-5 py-1.5 text-[11px] uppercase tracking-wider font-medium',
                  hasActive ? 'text-text' : 'text-text-faint hover:text-text-muted',
                )}
                aria-expanded={open}
                aria-controls={`nav-section-${section.key}`}
                data-testid={`nav-section-${section.key}`}
              >
                <Chevron open={open} />
                <span className="flex-1 text-left">{section.group}</span>
                {section.adminOnly && (
                  <span className="text-[9px] text-accent normal-case tracking-normal">
                    admin
                  </span>
                )}
              </button>
              {open && (
                <ul id={`nav-section-${section.key}`} className="mb-2 mt-0.5">
                  {section.items.map((item) => {
                    const active = isItemActive(pathname, item);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={item.title ?? item.label}
                          data-testid={`nav-${item.href}`}
                          className={cn(
                            'flex items-center justify-between pl-9 pr-5 py-1.5 text-sm border-l-2',
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
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border text-[11px] text-text-faint">
        <div className="font-medium text-text-muted mb-1">Not a load engine.</div>
        Records what you do. Cites what you read. Suggests nothing.
      </div>
    </aside>
  );
}
