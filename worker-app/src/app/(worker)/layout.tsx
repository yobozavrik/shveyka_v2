'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { LayoutGrid, History, UserCheck, LogOut, Scissors, Sun, Moon, ClipboardList } from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { href: '/tasks', label: 'Завдання', icon: ClipboardList },
  { href: '/batches', label: 'Партії', icon: LayoutGrid },
  { href: '/history', label: 'Моя робота', icon: History },
  { href: '/master', label: 'Майстер', icon: UserCheck },
];

const TASK_ROLES = new Set([
  'cutting',
  'sewing',
  'overlock',
  'straight_stitch',
  'coverlock',
  'packaging',
]);

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    fetch('/api/mobile/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.employee) {
          setUser({ ...data.employee, role: data.role });
        }
      })
      .catch(console.error);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/mobile/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] pb-20">
      <header className="sticky top-0 z-40 bg-[var(--bg-base)]/95 backdrop-blur border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider leading-none mb-1">МЕС ЦЕХ</span>
            <span className="text-sm font-bold text-[var(--text-1)] leading-none truncate max-w-[150px]">
              {user ? user.full_name : 'Завантаження...'}
            </span>
            {user && (
              <span className="text-[10px] text-[var(--text-3)] font-medium">№ {user.employee_number}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl text-[var(--text-3)] active:text-[var(--text-1)] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-[var(--text-3)] active:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-base)]/95 backdrop-blur border-t border-[var(--border)] safe-area-bottom">
        <div className="flex">
          {NAV.filter((item) => {
            if (item.href === '/tasks') {
              if (!user) return false;
              return TASK_ROLES.has((user.role || '').toLowerCase());
            }

            if (item.href === '/master' && user) {
              const role = (user.role || '').toLowerCase();
              const pos = (user.position || '').toLowerCase().trim();
              const isPrivileged =
                ['master', 'supervisor', 'admin'].includes(role) ||
                ['майстер', 'адміністратор'].includes(pos);
              return isPrivileged;
            }

            return true;
          }).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-semibold transition-colors cursor-pointer',
                  active ? 'text-emerald-500' : 'text-[var(--text-3)] active:text-[var(--text-2)]'
                )}
              >
                <Icon className={clsx('w-5 h-5', active ? 'text-emerald-500' : 'text-[var(--text-3)]')} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
