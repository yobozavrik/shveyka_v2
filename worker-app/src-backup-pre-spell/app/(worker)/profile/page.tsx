'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  User,
  TrendingUp,
  Calendar,
  Package,
  CheckCircle2,
  Clock,
  BarChart3,
  Wallet,
  ChevronRight,
} from 'lucide-react';
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

type StatsResponse = {
  employee: EmployeeData;
  earnings: {
    current_period: { amount: number; quantity: number };
    total: { amount: number; quantity: number };
    period_info: { id: number; period_start: string; period_end: string | null } | null;
  };
  today: {
    operations: number;
    quantity: number;
    batches: number;
  };
  all_time: {
    total_operations: number;
    total_quantity: number;
  };
  activity_by_day: Record<string, { amount: number; quantity: number; operations: number }>;
  stage_stats: Record<string, { name: string; operations: number; quantity: number }>;
  current_tasks: Array<{
    id: number;
    batch_number: string;
    product_name: string;
    status: string;
    stage_name: string;
    accepted_at: string | null;
  }>;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: 'short',
  });
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Сьогодні';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчора';

  return date.toLocaleDateString('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, payrollRes] = await Promise.all([
        fetch('/api/mobile/employee/stats', { cache: 'no-store' }),
        fetch('/api/mobile/employee/payroll', { cache: 'no-store' }),
      ]);

      if (!statsRes.ok) {
        const errData = await statsRes.json();
        throw new Error(errData.error || 'Не вдалося завантажити дані');
      }

      const statsData = await statsRes.json();
      const payrollData = payrollRes.ok ? await payrollRes.json() : { payroll_history: [] };

      setStats({ ...statsData, payroll_history: payrollData.payroll_history || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-5 space-y-5">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
        <button
          onClick={loadStats}
          className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white"
        >
          Спробувати знову
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { employee, earnings, today, all_time, activity_by_day, stage_stats, current_tasks } = stats;

  const recentDays = Object.entries(activity_by_day)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7);

  return (
    <div className="px-4 py-5 pb-24 space-y-5">
      {/* Profile Header */}
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-emerald-500/15 p-4 text-emerald-500">
            <User className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black text-[var(--text-1)] truncate">
              {employee.full_name}
            </h1>
            <div className="mt-1 text-sm text-[var(--text-2)]">
              {employee.position || 'Працівник'}
              {employee.employee_number ? ` · #${employee.employee_number}` : ''}
            </div>
            <div className="mt-1 text-xs text-[var(--text-3)]">
              {employee.department || ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold text-emerald-500">
            {employee.status === 'active' ? 'Активний' : employee.status}
          </span>
        </div>
      </section>

      {/* Earnings */}
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-500">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black text-[var(--text-1)]">Заробіток</div>
            <div className="text-xs text-[var(--text-3)]">
              {earnings.period_info ? `Період: ${formatDate(earnings.period_info.period_start)}` : 'Період не заданий'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              За період
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-500">
              {formatCurrency(earnings.current_period.amount)}
            </div>
            <div className="mt-1 text-xs text-[var(--text-2)]">
              {earnings.current_period.quantity} шт
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Загалом
            </div>
            <div className="mt-2 text-2xl font-black text-[var(--text-1)]">
              {formatCurrency(earnings.total.amount)}
            </div>
            <div className="mt-1 text-xs text-[var(--text-2)]">
              {earnings.total.quantity} шт
            </div>
          </div>
        </div>
      </section>

      {/* Today Stats */}
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-500">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black text-[var(--text-1)]">Сьогодні</div>
            <div className="text-xs text-[var(--text-3)]">
              {new Date().toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Операцій
            </div>
            <div className="mt-1 text-xl font-black text-[var(--text-1)]">
              {today.operations}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Штук
            </div>
            <div className="mt-1 text-xl font-black text-[var(--text-1)]">
              {today.quantity}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Партій
            </div>
            <div className="mt-1 text-xl font-black text-[var(--text-1)]">
              {today.batches}
            </div>
          </div>
        </div>
      </section>

      {/* Current Tasks */}
      {current_tasks.length > 0 && (
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-500/15 p-3 text-indigo-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black text-[var(--text-1)]">Мої завдання зараз</div>
              <div className="text-xs text-[var(--text-3)]">
                {current_tasks.length} активних
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {current_tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => router.push(`/tasks/${task.id}`)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4 text-left active:bg-[var(--bg-card2)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-bold text-emerald-500">
                      {task.batch_number}
                    </div>
                    <div className="mt-1 font-bold text-[var(--text-1)] truncate">
                      {task.product_name}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-2)]">
                      {task.stage_name}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={clsx(
                      'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                      task.status === 'accepted' && 'bg-blue-500/15 text-blue-500',
                      task.status === 'in_progress' && 'bg-emerald-500/15 text-emerald-500',
                    )}>
                      {task.status === 'accepted' ? 'Прийнято' : 'В роботі'}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--text-3)]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Activity by Day */}
      {recentDays.length > 0 && (
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-500">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black text-[var(--text-1)]">Активність</div>
              <div className="text-xs text-[var(--text-3)]">Останні 7 днів</div>
            </div>
          </div>

          <div className="space-y-2">
            {recentDays.map(([date, data]) => (
              <div
                key={date}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3"
              >
                <div>
                  <div className="text-sm font-bold text-[var(--text-1)]">
                    {formatDayLabel(date)}
                  </div>
                  <div className="text-xs text-[var(--text-3)]">
                    {data.operations} операцій · {data.quantity} шт
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-500">
                    {formatCurrency(data.amount || data.quantity * 10)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stage Statistics */}
      {Object.keys(stage_stats).length > 0 && (
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-teal-500/15 p-3 text-teal-500">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black text-[var(--text-1)]">По етапах</div>
              <div className="text-xs text-[var(--text-3)]">Загальна статистика</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stage_stats)
              .sort((a, b) => b[1].operations - a[1].operations)
              .map(([code, data]) => (
                <div
                  key={code}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] truncate">
                    {data.name}
                  </div>
                  <div className="mt-2 text-lg font-black text-[var(--text-1)]">
                    {data.operations} <span className="text-xs font-normal text-[var(--text-3)]">операцій</span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-2)]">
                    {data.quantity} шт
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* All Time Stats */}
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-2xl bg-slate-500/15 p-3 text-slate-500">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black text-[var(--text-1)]">За весь час</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Всього операцій
            </div>
            <div className="mt-1 text-2xl font-black text-[var(--text-1)]">
              {all_time.total_operations}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Всього штук
            </div>
            <div className="mt-1 text-2xl font-black text-[var(--text-1)]">
              {all_time.total_quantity}
            </div>
          </div>
        </div>
      </section>

      <div className="h-4" />
    </div>
  );
}
