'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useActivityLogger } from '@/hooks/useActivityLogger';

function Toggle({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'relative h-6 w-11 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-surface-container-highest',
      )}
    >
      <span
        className={clsx(
          'absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const activityLogger = useActivityLogger();
  const [user, setUser] = useState<any>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/mobile/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.employee) setUser({ ...data.employee, role: data.role });
      })
      .catch(console.error);
  }, []);

  async function handleLogout() {
    activityLogger.log('logout');
    await fetch('/api/mobile/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 pb-28 pt-6">
      <section className="relative overflow-hidden rounded-xl bg-surface-container p-6 shadow-lg">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-surface-container-highest">
            {user?.photo_url ? (
              <img src={user.photo_url} alt={user?.full_name || 'Профіль'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="material-symbols-outlined text-[34px] text-primary">person</span>
              </div>
            )}
          </div>
          <div className="flex-grow">
            <h2 className="text-2xl font-bold text-on-surface">{user?.full_name || 'Працівник'}</h2>
            <p className="mt-1 text-sm uppercase tracking-wide text-primary">
              {user?.position || 'Співробітник'} • {user?.department || 'Дільниця'}
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <section className="space-y-3">
          <h3 className="px-2 text-xs font-bold uppercase tracking-widest text-outline">Дані</h3>
          <div className="overflow-hidden rounded-xl bg-surface-container">
            <div className="group flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-surface-container-high">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span className="material-symbols-outlined">badge</span>
                </div>
                <div>
                  <p className="font-bold text-on-surface">Особиста інформація</p>
                  <p className="text-sm text-outline">ID: {user?.employee_number || '—'}</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline transition-transform group-hover:translate-x-1">
                chevron_right
              </span>
            </div>

            <div className="group flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-surface-container-high">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span className="material-symbols-outlined">work</span>
                </div>
                <div>
                  <p className="font-bold text-on-surface">Посада та кваліфікація</p>
                  <p className="text-sm text-outline">{user?.position || '—'}</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline transition-transform group-hover:translate-x-1">
                chevron_right
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="px-2 text-xs font-bold uppercase tracking-widest text-outline">Безпека</h3>
          <div className="overflow-hidden rounded-xl bg-surface-container">
            <div className="group flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-surface-container-high">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span className="material-symbols-outlined">lock</span>
                </div>
                <p className="font-bold text-on-surface">Змінити пароль</p>
              </div>
              <span className="material-symbols-outlined text-outline transition-transform group-hover:translate-x-1">
                chevron_right
              </span>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span className="material-symbols-outlined">fingerprint</span>
                </div>
                <p className="font-bold text-on-surface">Біометричний вхід</p>
              </div>
              <Toggle checked onClick={() => {}} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="px-2 text-xs font-bold uppercase tracking-widest text-outline">Сповіщення</h3>
          <div className="overflow-hidden rounded-xl bg-surface-container">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span className="material-symbols-outlined">notifications</span>
                </div>
                <p className="font-bold text-on-surface">Push-повідомлення</p>
              </div>
              <Toggle checked={pushEnabled} onClick={() => setPushEnabled((v) => !v)} />
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span className="material-symbols-outlined">volume_up</span>
                </div>
                <p className="font-bold text-on-surface">Звук при нових завданнях</p>
              </div>
              <Toggle checked={soundEnabled} onClick={() => setSoundEnabled((v) => !v)} />
            </div>
          </div>
        </section>
      </div>

      <div className="pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-error-container font-bold text-on-error-container transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined">logout</span>
          Вийти з акаунту
        </button>
      </div>
    </div>
  );
}
