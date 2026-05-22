'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV: Array<{
  group: string;
  items: Array<{ href: string; label: string; hint?: string }>;
}> = [
  {
    group: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/notebook', label: 'Notebook' },
    ],
  },
  {
    group: 'Library',
    items: [
      { href: '/cartridges', label: 'Cartridges' },
      { href: '/components', label: 'Components' },
      { href: '/loads', label: 'Loads' },
      { href: '/sessions', label: 'Range sessions' },
    ],
  },
  {
    group: 'Tools',
    items: [
      { href: '/data-tools', label: 'Data tools' },
      { href: '/settings', label: 'Settings' },
      { href: '/safety', label: 'Safety', hint: 'Required reading' },
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
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border bg-bg-surface">
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
                const active =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href + '/')) ||
                  (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-between px-5 py-1.5 text-sm border-l-2',
                        active
                          ? 'text-text bg-bg-alt border-accent'
                          : 'text-text-muted hover:text-text border-transparent hover:bg-bg-alt/60',
                      )}
                    >
                      <span>{item.label}</span>
                      {item.hint && (
                        <span className="text-[10px] text-accent">{item.hint}</span>
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
