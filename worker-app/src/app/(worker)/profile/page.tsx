'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type ActiveTask = {
  id: number;
  status: string;
  summary?: { quantity: number };
  batch?: {
    batch_number?: string;
    quantity?: number;
    product_models?: { name?: string } | null;
  } | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [payroll, setPayroll] = useState<any>(null);
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [userRes, payrollRes, tasksRes] = await Promise.all([
          fetch('/api/mobile/auth/me', { cache: 'no-store' }),
          fetch('/api/mobile/employee/payroll', { cache: 'no-store' }),
          fetch('/api/mobile/tasks', { cache: 'no-store' }),
        ]);

        const userData = await userRes.json();
        const payrollData = await payrollRes.json();
        const tasksData = await tasksRes.json();

        if (userData?.employee) setUser(userData.employee);
        setPayroll(payrollData);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const activeTask = useMemo(
    () => tasks.find((task) => task.status === 'accepted' || task.status === 'in_progress') || tasks[0],
    [tasks],
  );

  const currentAmount = Number(payroll?.current_period?.amount || 0);
  const yearlyAmount = Number(payroll?.year_total?.amount || payroll?.year_total || 0);
  const history = Array.isArray(payroll?.history) ? payroll.history : [];
  const todayQuantity = Number(payroll?.today?.quantity || payroll?.today_quantity || 0);
  const todayAmount = Number(payroll?.today?.amount || payroll?.today_amount || 0);
  const operationsCount = Number(payroll?.today?.operations || payroll?.operations_count || history.length || 0);
  const activeTasksCount = tasks.filter((task) => task.status === 'accepted' || task.status === 'in_progress').length;

  const stageRows = [
    { label: 'Розкрій', icon: 'content_cut', amount: Number(payroll?.by_stage?.cutting || 0) },
    { label: 'Пошив', icon: 'styler', amount: Number(payroll?.by_stage?.sewing || 0) },
    { label: 'Контроль', icon: 'check_circle', amount: Number(payroll?.by_stage?.quality || 0) },
  ].filter((item) => item.amount > 0);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-[40px] text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-28 pt-4">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 rounded-xl bg-surface-container p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary-container p-0.5">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-surface-container-highest">
                  {user?.photo_url ? (
                    <img src={user.photo_url} alt={user?.full_name || 'Профіль'} className="h-full w-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[34px] text-primary">person</span>
                  )}
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-on-surface">
                  {user?.full_name || 'Працівник'}
                </h1>
                <p className="font-medium text-on-surface-variant">
                  {user?.position || 'Співробітник'}
                </p>
                <div className="mt-2 inline-flex items-center rounded-full border border-primary/20 bg-primary-container/20 px-3 py-1">
                  <span className="mr-2 h-2 w-2 rounded-full bg-primary" />
                  <span className="text-[12px] font-bold uppercase tracking-wider text-primary">
                    Активний
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/settings')}
              className="rounded-xl p-2 text-outline transition-colors hover:text-primary"
              aria-label="Налаштування"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-surface-container-high p-6">
          <div className="absolute -right-4 -top-4 opacity-10">
            <span className="material-symbols-outlined text-[120px] filled">payments</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Заробіток
          </span>
          <div className="mt-4">
            <span className="text-4xl font-black tracking-tighter text-primary">
              {currentAmount.toLocaleString('uk-UA')} ₴
            </span>
            <p className="mt-1 text-sm text-on-surface-variant">Поточний баланс за період</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-surface-container-low p-6">
        <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Сьогодні
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-black tracking-tight text-on-surface">{todayQuantity}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-outline">Штук</p>
          </div>
          <div className="border-x border-outline-variant/30 text-center">
            <p className="text-3xl font-black tracking-tight text-primary">
              {todayAmount.toLocaleString('uk-UA')}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-outline">₴ сьогодні</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black tracking-tight text-on-surface">{operationsCount}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-outline">Операцій</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          <div className="rounded-xl bg-surface-container p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Мої завдання зараз</h2>
              <span className="material-symbols-outlined text-primary">pending_actions</span>
            </div>

            {activeTask ? (
              <button
                type="button"
                onClick={() => router.push(`/tasks/${activeTask.id}`)}
                className="flex w-full items-center rounded-xl bg-surface-container-highest p-4 text-left transition-all hover:bg-surface-bright"
              >
                <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                  <span className="material-symbols-outlined">inventory_2</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-on-surface">
                    {activeTask.batch?.batch_number || `#${activeTask.id}`}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {activeTask.batch?.product_models?.name || 'Активне завдання'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary">
                    {activeTask.summary?.quantity || 0}/{activeTask.batch?.quantity || 0}
                  </p>
                </div>
              </button>
            ) : (
              <div className="rounded-xl bg-surface-container-highest p-5 text-sm text-on-surface-variant">
                Наразі активних завдань немає
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-4 px-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              По етапах
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {(stageRows.length > 0 ? stageRows : [
                { label: 'Розкрій', icon: 'content_cut', amount: 0 },
                { label: 'Пошив', icon: 'styler', amount: todayQuantity },
                { label: 'Контроль', icon: 'check_circle', amount: 0 },
                { label: 'Пакування', icon: 'inventory_2', amount: 0 },
              ]).map((item) => (
                <div key={item.label} className="rounded-xl bg-surface-container-low p-4 text-center">
                  <span className="material-symbols-outlined mb-2 text-primary">{item.icon}</span>
                  <p className="text-sm font-bold text-on-surface">{item.label}</p>
                  <p className="text-xl font-black text-primary">{item.amount}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 md:col-span-2">
          <div className="rounded-xl bg-surface-container p-6">
            <h2 className="mb-6 text-lg font-bold tracking-tight">Історія виплат</h2>
            <div className="space-y-4">
              {history.length > 0 ? history.slice(0, 4).map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between rounded-xl bg-surface-container-highest p-4">
                  <div>
                    <p className="font-bold text-on-surface">{item.period}</p>
                    <p className="text-xs text-on-surface-variant">{item.quantity} шт</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-on-surface">
                      {Number(item.amount || 0).toLocaleString('uk-UA')} ₴
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {item.status}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl bg-surface-container-highest p-4 text-sm text-on-surface-variant">
                  Даних по виплатах ще немає
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border-l-4 border-primary bg-surface-container-high p-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              За весь час
            </span>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-3xl font-black tracking-tighter text-on-surface">
                  {yearlyAmount.toLocaleString('uk-UA')} ₴
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-on-surface-variant">
                  Сумарний заробіток
                </p>
              </div>
              <div className="rounded-xl bg-surface-container p-3">
                <span className="material-symbols-outlined filled text-primary">workspace_premium</span>
              </div>
            </div>
            <div className="mt-4 text-sm text-on-surface-variant">
              Активних задач: <span className="font-bold text-on-surface">{activeTasksCount}</span>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          await fetch('/api/mobile/auth/logout', { method: 'POST' });
          router.push('/login');
        }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-error-container font-bold text-on-error-container transition-all active:scale-[0.98]"
      >
        <span className="material-symbols-outlined">logout</span>
        Вийти з акаунту
      </button>
    </div>
  );
}
