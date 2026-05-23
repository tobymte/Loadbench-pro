import Link from 'next/link';
import { cn } from '@/lib/utils';

export type Crumb = {
  href?: string;
  label: string;
};

export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex items-center gap-1.5 text-[11px] text-text-muted',
        className,
      )}
      data-testid="breadcrumbs"
    >
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${i}-${c.label}`} className="flex items-center gap-1.5">
            {c.href && !last ? (
              <Link
                href={c.href}
                className="hover:text-text underline-offset-2 hover:underline"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={cn(
                  last ? 'text-text' : 'text-text-muted',
                  'font-medium',
                )}
                aria-current={last ? 'page' : undefined}
              >
                {c.label}
              </span>
            )}
            {!last && <span className="text-text-faint">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
