'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

type TaskListItem = {
  id: number;
  batch_id: number;
  status: string;
  launched_at: string | null;
  notes: string | null;
  summary: { rolls: number; quantity: number };
  batch: {
    id: number;
    batch_number: string;
    status: string;
    quantity: number;
    is_urgent: boolean;
    priority: string;
    fabric_type: string | null;
    fabric_color: string | null;
    planned_end_date: string | null;
    product_models: { id: number; name: string; sku: string } | null;
  } | null;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function statusUi(status: string) {
  if (status === 'pending') {
    return {
      label: 'Очікує',
      badge: 'bg-amber-100 text-amber-800',
      progressText: 'text-slate-400',
      progressBar: 'bg-slate-300',
    };
  }

  if (status === 'completed') {
    return {
      label: 'Готово',
      badge: 'bg-emerald-100 text-emerald-800',
      progressText: 'text-primary',
      progressBar: 'bg-gradient-to-r from-primary to-primary-container',
    };
  }

  return {
    label: 'В роботі',
    badge: 'bg-secondary-container text-on-secondary-container',
    progressText: 'text-primary',
    progressBar: 'bg-gradient-to-r from-primary to-primary-container',
  };
}

function TaskCard({ task }: { task: TaskListItem }) {
  const router = useRouter();
  const batch = task.batch;
  const percent = batch?.quantity ? Math.min(100, Math.round((task.summary.quantity / batch.quantity) * 100)) : 0;
  const ui = statusUi(task.status);

  return (
    <button
      type="button"
      onClick={() => router.push(`/tasks/${task.id}`)}
      className={clsx(
        'group w-full cursor-pointer rounded-[20px] bg-surface-container-lowest p-5 text-left transition-all active:scale-[0.98]',
        task.status !== 'pending' && 'border-l-4 border-primary',
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider', ui.badge)}>
            {ui.label}
          </span>
          <span className="font-mono text-sm text-slate-400">
            {batch?.batch_number || `П-${task.batch_id}`}
          </span>
        </div>
        <span className="material-symbols-outlined text-slate-300 transition-transform group-hover:translate-x-1">
          arrow_forward
        </span>
      </div>

      <h3 className="mb-2 text-[24px] font-black leading-tight text-on-surface">
        {batch?.product_models?.name || 'Без моделі'}
      </h3>

      <div className="mb-5 flex flex-wrap gap-x-3 gap-y-2">
        <div className="flex items-center gap-1 text-sm font-medium text-slate-500">
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          <span>{batch?.quantity || 0} шт</span>
        </div>

        {batch?.is_urgent && (
          <div className="flex items-center gap-1 text-sm font-bold text-tertiary">
            <span className="material-symbols-outlined text-[18px]">priority_high</span>
            <span>Терміново</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-sm font-medium text-slate-500">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          <span>{formatDate(batch?.planned_end_date)}</span>
        </div>
      </div>

      <div className="mb-5 flex gap-4 rounded-xl bg-surface-container-low p-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Тканина</p>
          <p className="text-sm font-bold text-on-surface-variant">{batch?.fabric_type || '—'}</p>
        </div>
        <div className="w-px bg-outline-variant/30" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Колір</p>
          <p className="text-sm font-bold text-on-surface-variant">{batch?.fabric_color || '—'}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <span className={clsx('text-[12px] font-bold tracking-tight', ui.progressText)}>
            Прогрес виробництва
          </span>
          <span className={clsx('text-[16px] font-black', ui.progressText)}>
            {task.summary.quantity}/{batch?.quantity || 0}
          </span>
        </div>
        <div className="progress-track w-full bg-surface-container-high">
          <div
            className={clsx('h-full rounded-full transition-all', ui.progressBar)}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </button>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/mobile/tasks', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося завантажити завдання');
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити завдання');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTasks = useMemo(() => {
    if (filter === 'working') return tasks.filter((task) => task.status !== 'pending');
    if (filter === 'pending') return tasks.filter((task) => task.status === 'pending');
    return tasks;
  }, [filter, tasks]);

  return (
    <div className="px-6 pb-24 pt-4">
      <section className="no-scrollbar mb-8 flex gap-2 overflow-x-auto py-2">
        {[
          { id: 'all', label: 'Усі' },
          { id: 'working', label: 'В роботі' },
          { id: 'pending', label: 'Очікує' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={clsx(
              'rounded-full px-6 py-2.5 text-sm font-bold transition-colors',
              filter === item.id
                ? 'scale-95 bg-primary text-on-primary shadow-lg shadow-primary/20'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
            )}
          >
            {item.label}
          </button>
        ))}
      </section>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4 text-center text-sm font-bold text-error">
          {error}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-[20px] border border-dashed border-outline-variant/30 bg-surface-container-low text-sm font-medium italic text-outline">
          Наразі завдань немає
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
