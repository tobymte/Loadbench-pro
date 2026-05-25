import { MobileNav } from '@/components/layout/MobileNav';
import { getAdminContext } from '@/lib/auth/admin';

export async function Topbar({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  // Mirror the desktop sidebar's admin gating in the mobile drawer. Any
  // failure to resolve admin context degrades to non-admin so the operator
  // section stays hidden for unauthenticated users.
  let isAdmin = false;
  try {
    const ctx = await getAdminContext();
    isAdmin = ctx.isAdmin;
  } catch {
    isAdmin = false;
  }

  return (
    <header className="h-14 shrink-0 border-b border-border bg-bg-surface flex items-center gap-3 px-4 sm:px-6 print:hidden">
      <MobileNav isAdmin={isAdmin} />
      <h1 className="text-base font-semibold text-text tracking-tight truncate">
        {title}
      </h1>
      <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
        {actions}
      </div>
    </header>
  );
}
