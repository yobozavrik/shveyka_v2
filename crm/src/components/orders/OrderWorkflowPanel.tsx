'use client';

import { useEffect, useState } from 'react';
import { Archive, Ban, CheckCircle, Clock3, Factory, Loader2, PackageCheck, Play, Wrench } from 'lucide-react';

type OrderEvent = {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  stage_label: string | null;
  note: string | null;
  payload: Record<string, any> | null;
  created_by: number | null;
  created_at: string;
  field_name?: string | null;
  old_value?: any;
  new_value?: any;
  entry_type?: 'event' | 'field_change';
};

type Props = {
  orderId: number;
  currentStatus: string;
  canLaunch?: boolean;
  onChanged?: () => Promise<void> | void;
};

type ActionKey =
  | 'approve'
  | 'material_check'
  | 'launch'
  | 'complete'
  | 'transfer_to_warehouse'
  | 'close'
  | 'cancel';

const ACTION_META: Record<ActionKey, { label: string; icon: any; className: string }> = {
  approve: { label: 'Затвердити', icon: CheckCircle, className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  material_check: { label: 'Перевірити матеріали', icon: Wrench, className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  launch: { label: 'Запустити', icon: Play, className: 'bg-green-600 hover:bg-green-700 text-white' },
  complete: { label: 'Завершити', icon: PackageCheck, className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  transfer_to_warehouse: { label: 'Передати на склад', icon: Factory, className: 'bg-cyan-600 hover:bg-cyan-700 text-white' },
  close: { label: 'Закрити', icon: Archive, className: 'bg-slate-700 hover:bg-slate-800 text-white' },
  cancel: { label: 'Скасувати', icon: Ban, className: 'bg-red-50 hover:bg-red-100 text-red-600' },
};

async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || 'Неочікувана відповідь сервера');
  }
}

export function OrderWorkflowPanel({ orderId, currentStatus, canLaunch = false, onChanged }: Props) {
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [running, setRunning] = useState<ActionKey | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/production-orders/${orderId}/events`);
      const data = await readJsonResponse<OrderEvent[]>(res);
      if (res.ok) {
        setEvents(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load production order events', e);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const runAction = async (action: ActionKey) => {
    setRunning(action);
    setError(null);
    try {
      const res = await fetch(`/api/production-orders/${orderId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) {
        throw new Error(data?.error || 'Помилка операції');
      }

      setNote('');
      await loadEvents();
      await onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(null);
    }
  };

  const visibleActions = (['approve', 'material_check', 'launch', 'complete', 'transfer_to_warehouse', 'close', 'cancel'] as ActionKey[]).filter((action) => {
    if (action === 'approve') return currentStatus === 'draft';
    if (action === 'material_check') return ['approved', 'launched', 'in_production'].includes(currentStatus);
    if (action === 'launch') return currentStatus === 'approved' && canLaunch;
    if (action === 'complete') return ['launched', 'in_production'].includes(currentStatus);
    if (action === 'transfer_to_warehouse') return currentStatus === 'completed';
    if (action === 'close') return currentStatus === 'warehouse_transferred';
    if (action === 'cancel') return ['draft', 'approved'].includes(currentStatus);
    return false;
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <Clock3 size={15} /> Робочий процес
          </h2>
          <p className="text-xs text-gray-400 mt-1">Етапи, які керівник виробництва може відмічати вручну.</p>
        </div>
        <button
          onClick={loadEvents}
          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
          disabled={loadingEvents}
        >
          {loadingEvents ? <Loader2 size={12} className="animate-spin" /> : <Clock3 size={12} />}
          Оновити лог
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Нотатка до етапу: причина, коментар, фактичні дані, особливості передання"
          />
          <div className="flex flex-wrap gap-2 md:col-span-2">
            {visibleActions.map((action) => {
              const meta = ACTION_META[action];
              const Icon = meta.icon;
              return (
                <button
                  key={action}
                  onClick={() => runAction(action)}
                  disabled={running !== null}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${meta.className} ${action === 'cancel' ? 'border border-red-200' : ''}`}
                >
                  {running === action ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Журнал етапів</h3>
          {events.length === 0 ? (
            <div className="text-sm text-gray-400 py-4">Ще немає подій.</div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-gray-900 capitalize">
                      {event.entry_type === 'field_change'
                        ? `Зміна поля: ${String(event.field_name || event.action).replace(/_/g, ' ')}`
                        : event.action.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-gray-400">{new Date(event.created_at).toLocaleString('uk-UA')}</div>
                  </div>
                  {event.entry_type === 'field_change' ? (
                    <div className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">Було:</span> {JSON.stringify(event.old_value ?? '—')}
                      <span className="mx-2">→</span>
                      <span className="font-medium">Стало:</span> {JSON.stringify(event.new_value ?? '—')}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-1">
                      {event.from_status || '—'} · {event.to_status || '—'}
                      {event.stage_label ? ` · ${event.stage_label}` : ''}
                    </div>
                  )}
                  {event.note && <div className="text-sm text-gray-700 mt-2">{event.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
