'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import clsx from 'clsx';

type EmployeeData = {
  id: number;
  full_name: string;
  employee_number: string | null;
  position: string | null;
  department: string | null;
  photo_url: string | null;
  status: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch('/api/mobile/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.employee) {
          setEmployee(data.employee);
        }
      })
      .catch(() => setError('Не вдалося завантажити дані'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch('/api/mobile/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-[40px] text-primary animate-spin">progress_activity</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-5">
        <div className="flex items-center gap-3 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined text-lg shrink-0">error</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 pb-24 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-primary font-medium active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          <span className="text-sm font-bold">Назад</span>
        </button>
        <h1 className="text-xl font-black tracking-tighter absolute left-1/2 -translate-x-1/2">
          Налаштування
        </h1>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high flex items-center justify-center">
          {employee?.photo_url ? (
            <img src={employee.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">person</span>
          )}
        </div>
      </div>

      {/* Security */}
      <section className="space-y-3">
        <h3 className="px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Безпека
        </h3>
        <div className="bg-surface-container-low dark:bg-surface-container rounded-[20px] overflow-hidden">
          <button className="w-full flex justify-between items-center p-5 bg-surface-container-lowest dark:bg-surface-container active:bg-surface-container-high dark:active:bg-surface-container-highest transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">pin</span>
              </div>
              <span className="font-bold">Змінити PIN</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </button>
          <div className="h-[1px] bg-surface-container-high dark:bg-surface-container-highest mx-5" />
          <button className="w-full flex justify-between items-center p-5 bg-surface-container-lowest dark:bg-surface-container active:bg-surface-container-high dark:active:bg-surface-container-highest transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">lock</span>
              </div>
              <span className="font-bold">Змінити пароль</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-3">
        <h3 className="px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Сповіщення
        </h3>
        <div className="bg-surface-container-low dark:bg-surface-container rounded-[20px] overflow-hidden">
          <div className="w-full flex justify-between items-center p-5 bg-surface-container-lowest dark:bg-surface-container">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary-container/30 dark:bg-secondary/10 flex items-center justify-center text-secondary dark:text-secondary">
                <span className="material-symbols-outlined">notifications</span>
              </div>
              <span className="font-bold">Push-сповіщення</span>
            </div>
            <button
              onClick={() => setPushEnabled(!pushEnabled)}
              className={clsx(
                'w-14 h-8 rounded-full relative p-1 transition-colors',
                pushEnabled ? 'bg-primary' : 'bg-surface-container-highest dark:bg-surface-dim',
              )}
            >
              <div
                className={clsx(
                  'w-6 h-6 bg-white rounded-full shadow-md transition-transform',
                  pushEnabled ? 'translate-x-6' : 'translate-x-0',
                )}
              />
            </button>
          </div>
          <div className="h-[1px] bg-surface-container-high dark:bg-surface-container-highest mx-5" />
          <div className="w-full flex justify-between items-center p-5 bg-surface-container-lowest dark:bg-surface-container">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary-container/30 dark:bg-secondary/10 flex items-center justify-center text-secondary dark:text-secondary">
                <span className="material-symbols-outlined">volume_up</span>
              </div>
              <span className="font-bold">Звук при нових завданнях</span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={clsx(
                'w-14 h-8 rounded-full relative p-1 transition-colors',
                soundEnabled ? 'bg-primary' : 'bg-surface-container-highest dark:bg-surface-dim',
              )}
            >
              <div
                className={clsx(
                  'w-6 h-6 bg-white rounded-full shadow-md transition-transform',
                  soundEnabled ? 'translate-x-6' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Employee Data */}
      <section className="space-y-3">
        <h3 className="px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Дані
        </h3>
        <div className="bg-surface-container-highest dark:bg-surface-container-high rounded-[20px] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 dark:bg-primary/10 rounded-full -mr-10 -mt-10 blur-3xl" />
          <div className="space-y-5 relative z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Номер працівника</span>
              <p className="text-xl font-black text-primary">#{employee?.employee_number || '—'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Посада</span>
                <p className="font-bold">{employee?.position || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Відділ</span>
                <p className="font-bold">{employee?.department || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Theme Toggle */}
      <section className="space-y-3">
        <h3 className="px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Вигляд
        </h3>
        <div className="bg-surface-container-low dark:bg-surface-container rounded-[20px] overflow-hidden">
          <div className="w-full flex justify-between items-center p-5 bg-surface-container-lowest dark:bg-surface-container">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">
                  {mounted && theme === 'dark' ? 'dark_mode' : 'light_mode'}
                </span>
              </div>
              <span className="font-bold">Темна тема</span>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={clsx(
                'w-14 h-8 rounded-full relative p-1 transition-colors',
                theme === 'dark' ? 'bg-primary' : 'bg-surface-container-highest',
              )}
            >
              <div
                className={clsx(
                  'w-6 h-6 bg-white rounded-full shadow-md transition-transform',
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Logout */}
      <div className="pt-4 space-y-4">
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full h-[56px] rounded-[16px] bg-error/10 dark:bg-error/20 text-error font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
        >
          <span className="material-symbols-outlined">logout</span>
          Вийти з акаунту
        </button>
        <p className="text-center text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
          Версія додатка 1.0.0
        </p>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-[28px] border border-outline-variant/30 dark:border-outline-variant/15 bg-surface-container-lowest dark:bg-surface-container p-6 shadow-2xl space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-error/10 dark:bg-error/20 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[32px] text-error">logout</span>
              </div>
              <h3 className="text-lg font-black">Вийти з акаунту?</h3>
              <p className="text-sm text-on-surface-variant mt-2">
                Вам доведеться знову ввести номер працівника та пароль для входу.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="rounded-2xl border border-outline-variant/30 dark:border-outline-variant/15 bg-surface-container-high dark:bg-surface-container-highest px-4 py-3 text-sm font-black text-on-surface-variant"
              >
                Скасувати
              </button>
              <button
                onClick={handleLogout}
                className="rounded-2xl bg-error px-4 py-3 text-sm font-black text-on-error"
              >
                Вийти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
