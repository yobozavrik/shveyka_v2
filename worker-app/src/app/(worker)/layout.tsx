'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useNotificationCount } from '@/hooks/useNotificationCount';
import { useActivityLogger } from '@/hooks/useActivityLogger';

const NAV = [
  { href: '/tasks', label: 'Завдання', icon: 'assignment' },
  { href: '/batches', label: 'Партії', icon: 'inventory_2' },
  { href: '/master', label: 'Майстер', icon: 'person_search' },
  { href: '/profile', label: 'Профіль', icon: 'account_circle' },
];

const TASK_ROLES = new Set([
  'cutting',
  'sewing',
  'overlock',
  'straight_stitch',
  'coverlock',
  'packaging',
]);

function NotificationBell() {
  const {
    count,
    notifications,
    dismissed,
    dismiss,
    refetch,
    requestNotificationPermission,
  } = useNotificationCount();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleBellClick() {
    requestNotificationPermission();
    setOpen((value) => !value);
  }

  function handleTaskClick(taskId: number) {
    setOpen(false);
    router.push(`/tasks/${taskId}`);
    setTimeout(() => refetch(), 500);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleBellClick}
        className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-300"
        aria-label={count > 0 ? `Сповіщення: ${count}` : 'Сповіщення'}
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: `'FILL' ${count > 0 ? 1 : 0}` }}
        >
          {count > 0 ? 'notifications_active' : 'notifications'}
        </span>
        {count > 0 && !dismissed && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && !dismissed && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-outline-variant/15 bg-white shadow-xl dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-outline-variant/10 px-4 py-3">
            <span className="text-sm font-bold text-on-surface">Нові завдання</span>
            <span className="text-xs font-medium text-on-surface-variant">{count} шт.</span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-on-surface-variant">
                Завантаження...
              </div>
            ) : (
              notifications.map((item: any) => (
                <button
                  key={item.task_id}
                  type="button"
                  onClick={() => handleTaskClick(item.task_id)}
                  className="flex w-full items-start gap-3 border-b border-outline-variant/5 px-4 py-3 text-left transition-colors hover:bg-surface-container-low last:border-b-0 dark:hover:bg-surface-container-highest/40"
                >
                  {item.is_urgent ? (
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-red-500">
                      priority_high
                    </span>
                  ) : (
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-emerald-600">
                      assignment
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary">
                        {item.batch_number}
                      </span>
                      {item.is_urgent && (
                        <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-500">
                          Терміново
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold text-on-surface">
                      {item.product_name}
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {item.stage_name}
                    </p>
                  </div>

                  <span className="material-symbols-outlined mt-1 shrink-0 text-[18px] text-slate-400">
                    chevron_right
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-outline-variant/10 px-4 py-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                dismiss();
              }}
              className="w-full py-1 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Приховати
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const activityLogger = useActivityLogger();

  useEffect(() => {
    fetch('/api/mobile/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.employee) {
          setUser({ ...data.employee, role: data.role });
        }
      })
      .catch(console.error);
  }, []);

  const handleLogout = useCallback(async () => {
    activityLogger.log('logout');
    await fetch('/api/mobile/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }, [activityLogger, router]);

  const visibleNav = useMemo(() => {
    return NAV.filter((item) => {
      if (item.href === '/tasks') {
        if (!user) return false;
        return TASK_ROLES.has((user.role || '').toLowerCase());
      }

      if (item.href === '/master' && user) {
        const role = (user.role || '').toLowerCase();
        const pos = (user.position || '').toLowerCase().trim();
        return ['master', 'supervisor', 'admin'].includes(role) ||
          ['майстер', 'адміністратор'].includes(pos);
      }

      return true;
    });
  }, [user]);

  const pageTitle = useMemo(() => {
    const item = NAV.find((navItem) => pathname.startsWith(navItem.href));
    return item ? item.label : 'МЕС ЦЕХ';
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background pb-24 pt-16 text-on-surface antialiased">
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between bg-white/70 px-6 backdrop-blur-md dark:bg-slate-900/70">
        <div className="flex flex-col">
          <span className="mb-1 text-[14px] font-medium leading-none text-slate-500">
            Привіт, {user?.full_name?.split(' ')[0] || 'працівнику'}!
          </span>
          <h1 className="text-xl font-black tracking-tight text-emerald-900 dark:text-emerald-400">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />

          <button
            type="button"
            onClick={handleLogout}
            className="hidden rounded-xl bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:text-on-surface sm:block"
          >
            Вийти
          </button>

          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-primary-container/20 bg-surface-container">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuANeQdtu8zTZ14HPiKVm4c0W3oUxGD2G35VS-4Vbqtq6gMiogx1TG006ovyOK3_bL1wyMBQGbp7OIvn5jgka7yFaGXfoMc8NJS-IGyVkHKagzi-NSDChu5Y2yJG1NH8lbOWXYj3Cxia10TsfYszy2saWuisSyVHw-c3zxMSwkm0BQfs54E3ZPgT0VOZ_OcoOZylh00sC74e2GqziVjNfCNHIXmE25nFeZMRvN3_ECffl5P9TcuiK9sf_6-jeD8np80a1lXrRseb_XM"
              alt="Профіль"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl">{children}</main>

      <nav className="safe-area-bottom fixed bottom-0 left-0 z-50 flex h-[64px] w-full items-center justify-around bg-white px-4 pb-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:bg-slate-950">
        {visibleNav.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center px-5 py-1.5 transition-all active:scale-90',
                active
                  ? 'rounded-2xl bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                  : 'text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300',
              )}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: `'FILL' ${active ? 1 : 0}` }}
              >
                {item.icon}
              </span>
              <span className="text-[12px] font-bold tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
