import { Sidebar } from '@/components/layout/Sidebar';
import { SafetyBanner } from '@/components/layout/SafetyBanner';
import { getAdminContext } from '@/lib/auth/admin';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Resolve admin status server-side and hand it to the sidebar/mobile nav.
  // Failure to determine admin status (no auth env, etc.) must not block app
  // navigation — fall back to non-admin so the operator section stays hidden.
  let isAdmin = false;
  try {
    const ctx = await getAdminContext();
    isAdmin = ctx.isAdmin;
  } catch {
    isAdmin = false;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SafetyBanner />
      <div className="flex-1 flex">
        <Sidebar isAdmin={isAdmin} />
        <main className="flex-1 min-w-0 flex flex-col bg-bg">{children}</main>
      </div>
    </div>
  );
}
