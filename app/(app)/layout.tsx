import { Sidebar } from '@/components/layout/Sidebar';
import { SafetyBanner } from '@/components/layout/SafetyBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SafetyBanner />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col bg-bg">{children}</main>
      </div>
    </div>
  );
}
