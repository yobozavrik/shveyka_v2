import Sidebar from '@/components/Sidebar';
import { getAuth } from '@/lib/auth-server';
import { ConfirmPortal } from '@/components/ui/ConfirmPortal';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  const role = auth?.role || 'admin';
  const username = auth?.username || 'Користувач';

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-1)] overflow-hidden">
      <Sidebar userRole={role} username={username} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
      <ConfirmPortal />
    </div>
  );
}
