'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ClipboardList, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

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

function parseFabricColors(value?: string | null) {
  if (!value) return [] as { color: string; rolls: number }[];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)(?:\s*\((\d+)\))?$/);
      return {
        color: match?.[1]?.trim() || part,
        rolls: Number(match?.[2] || 1),
      };
    });
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mobile/tasks', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Не вдалося завантажити завдання');
      }
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

  return (
    <div className="px-4 py-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-1)] flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-emerald-500" />
            Завдання
          </h1>
          <p className="text-xs text-[var(--text-3)] mt-1">
            {tasks.length} активних завдань
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2.5 rounded-xl bg-[var(--bg-card2)] text-[var(--text-2)]"
        >
          <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] px-6 py-16 text-center text-[var(--text-3)]">
          <ClipboardList className="mx-auto mb-3 w-12 h-12 opacity-30" />
          <div className="text-sm font-semibold">Немає завдань</div>
          <div className="mt-1 text-xs">Якщо очікуєте партію, зверніться до майстра</div>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => {
          const batch = task.batch;
          const colors = parseFabricColors(batch?.fabric_color || null);
          const deadline = batch?.planned_end_date
            ? new Date(batch.planned_end_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
            : '—';
          const statusLabel =
            task.status === 'pending' ? 'Очікує' : task.status === 'accepted' ? 'Прийнято' : 'В роботі';
          const statusClass =
            task.status === 'pending'
              ? 'bg-amber-500/15 text-amber-500'
              : task.status === 'accepted'
                ? 'bg-blue-500/15 text-blue-500'
                : 'bg-emerald-500/15 text-emerald-500';

          return (
            <button
              key={task.id}
              onClick={() => router.push(`/tasks/${task.id}`)}
              className="w-full rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left transition-colors active:bg-[var(--bg-card2)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {batch?.is_urgent && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-500">
                        Терміново
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold text-emerald-500">{batch?.batch_number || `#${task.batch_id}`}</span>
                  </div>

                  <div className="truncate text-base font-black text-[var(--text-1)]">
                    {batch?.product_models?.name || 'Без моделі'}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-3)]">
                    <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider', statusClass)}>
                      {statusLabel}
                    </span>
                    <span>•</span>
                    <span>{batch?.quantity || 0} шт</span>
                    <span>•</span>
                    <span>{task.summary.rolls} рулонів</span>
                    <span>•</span>
                    <span>{deadline}</span>
                  </div>

                  {batch?.fabric_type && (
                    <div className="mt-2 text-xs text-[var(--text-2)]">
                      Тканина: <span className="font-semibold text-[var(--text-1)]">{batch.fabric_type}</span>
                    </div>
                  )}

                  {colors.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {colors.map((item) => (
                        <span
                          key={`${item.color}-${item.rolls}`}
                          className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-2)]"
                        >
                          {item.color} · {item.rolls} рул.
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <ChevronRight className="mt-1 w-5 h-5 shrink-0 text-[var(--text-3)]" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
