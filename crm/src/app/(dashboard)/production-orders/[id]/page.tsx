'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { showConfirm } from '@/lib/confirm';
import { OrderWorkflowPanel } from '@/components/orders/OrderWorkflowPanel';

type ProductionOrder = {
  id: number;
  order_number: string;
  order_type: 'stock' | 'customer';
  status: string;
  priority: string | null;
  total_quantity: number;
  total_lines: number;
  order_date: string | null;
  created_at: string;
  planned_completion_date: string | null;
  notes: string | null;
  base_models?: { name: string } | null;
};

type MaterialRequirement = {
  id: number;
  material_name: string;
  unit_of_measure: string | null;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  status: 'ok' | 'shortage';
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Чернетка',
  approved: 'Затверджено',
  launched: 'Запущено',
  in_production: 'У виробництві',
  in_progress: 'В роботі',
  completed: 'Завершено',
  warehouse_transferred: 'Передано на склад',
  closed: 'Закрито',
  cancelled: 'Скасовано',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  launched: 'bg-green-100 text-green-700',
  in_production: 'bg-green-100 text-green-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  warehouse_transferred: 'bg-cyan-100 text-cyan-700',
  closed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-100 text-red-600',
};

type RequirementsResponse = {
  has_shortage: boolean;
  can_launch: boolean;
  materials: MaterialRequirement[];
};

export default function ProductionOrderDetailPage() {
  const params = useParams();
  const orderId = useMemo(() => String(params?.id || ''), [params?.id]);

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [requirements, setRequirements] = useState<RequirementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const [editForm, setEditForm] = useState({
    planned_completion_date: '',
    priority: 'normal',
    notes: '',
  });

  const loadRequirements = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/production-orders/${orderId}/requirements`);
      if (!res.ok) {
        setRequirements(null);
        return;
      }
      const data = await res.json();
      setRequirements(data);
    } catch (e) {
      console.error('Failed to load requirements', e);
      setRequirements(null);
    }
  }, [orderId]);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/production-orders/${orderId}`);
      if (!res.ok) {
        setOrder(null);
        return;
      }
      const data = await res.json();
      setOrder(data);
      setEditForm({
        planned_completion_date: data?.planned_completion_date || '',
        priority: data?.priority || 'normal',
        notes: data?.notes || '',
      });
    } catch (e) {
      console.error('Failed to load order', e);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadOrder(), loadRequirements()]);
    setRefreshing(false);
  }, [loadOrder, loadRequirements]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleSaveEdit = async () => {
    if (!orderId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/production-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planned_completion_date: editForm.planned_completion_date || null,
          priority: editForm.priority,
          notes: editForm.notes || null,
        }),
      });

      if (!res.ok) throw new Error('Помилка збереження');
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('Не вдалося зберегти зміни');
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async () => {
    if (!orderId || !order) return;
    const ok = await showConfirm('Запустити у виробництво?');
    if (!ok) return;

    setLaunching(true);
    try {
      const res = await fetch(`/api/production-orders/${orderId}/launch`, { method: 'POST' });
      if (!res.ok) throw new Error('Помилка запуску');
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('Не вдалося запустити замовлення');
    } finally {
      setLaunching(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderId || !order) return;
    const ok = await showConfirm('Скасувати замовлення?');
    if (!ok) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/production-orders/${orderId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Помилка скасування');
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('Не вдалося скасувати замовлення');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-8 text-center text-gray-500">Замовлення не знайдено</div>;
  }

  const canCreateBatch = ['approved', 'launched', 'in_production'].includes(order.status);
  const canLaunch = order.status === 'approved';
  const canCancel = ['draft', 'approved'].includes(order.status);
  const displayDate = order.order_date || order.created_at;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-gray-900">{order.order_number}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[order.status] || order.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Пріоритет: {order.priority || 'normal'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshAll()}
            className="h-10 w-10 rounded-lg border border-gray-200 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50"
            title="Оновити"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>

          {canCreateBatch && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              <Plus size={16} />
              Створити партію
            </button>
          )}

          {canLaunch && (
            <button
              onClick={() => void handleLaunch()}
              disabled={launching}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg font-semibold"
            >
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play size={16} />}
              Запустити у виробництво
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => void handleCancelOrder()}
              disabled={cancelling}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 rounded-lg font-semibold border border-red-200"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle size={16} />}
              Скасувати
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <FileText size={15} /> Інформація про замовлення
          </h2>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">Дата</div>
            <div className="mt-1 font-semibold text-gray-900">{new Date(displayDate).toLocaleDateString('uk-UA')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">Тип</div>
            <div className="mt-1 font-semibold text-gray-900">{order.order_type === 'customer' ? 'Замовнику' : 'На склад'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">Кількість</div>
            <div className="mt-1 text-4xl leading-none font-bold text-gray-900">
              {order.total_quantity}
              <span className="text-base font-semibold text-gray-400 ml-2">шт</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold">Позицій</div>
            <div className="mt-1 text-4xl leading-none font-bold text-gray-900">{order.total_lines || 1}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <RefreshCw size={15} /> Редагування замовлення
          </h2>
          <button
            onClick={() => void handleSaveEdit()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
            Зберегти зміни
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">Планова дата завершення</label>
              <div className="relative">
                <input
                  type="date"
                  value={editForm.planned_completion_date}
                  onChange={(e) => setEditForm((p) => ({ ...p, planned_completion_date: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 pr-10 text-sm"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">Пріоритет</label>
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value }))}
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
              >
                <option value="low">Низький</option>
                <option value="normal">Звичайний</option>
                <option value="high">Високий</option>
                <option value="urgent">Терміновий</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase font-semibold mb-2">Примітки</label>
            <textarea
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Додаткові коментарі"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <OrderWorkflowPanel
        orderId={order.id}
        currentStatus={order.status}
        canLaunch={canLaunch}
        onChanged={refreshAll}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <ShieldAlert size={15} /> Вимоги до матеріалів
          </h2>
        </div>
        <div className="p-5">
          {!requirements || requirements.materials.length === 0 ? (
            <div className="text-sm text-gray-400">Немає даних про матеріали.</div>
          ) : (
            <div className="space-y-3">
              {requirements.materials.map((material) => (
                <div key={material.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center border border-gray-100 rounded-lg p-3">
                  <div className="font-medium text-gray-900">{material.material_name}</div>
                  <div className="text-sm text-gray-500">
                    Потрібно: <span className="font-semibold text-gray-800">{material.required_quantity}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Є: <span className="font-semibold text-gray-800">{material.available_quantity}</span>
                  </div>
                  <div className="text-sm">
                    {material.shortage_quantity > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                        <XCircle size={14} />
                        Дефіцит {material.shortage_quantity}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle2 size={14} />
                        OK
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/35 p-6 overflow-y-auto" onClick={() => setShowBatchModal(false)}>
          <div className="mx-auto max-w-2xl bg-white rounded-xl border border-gray-200 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Створити партію</h3>
              <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Для цього замовлення партії створюються через API маршрут:
              <br />
              <code className="text-xs bg-gray-100 rounded px-2 py-1">POST /api/production-orders/{order.id}/batches</code>
            </p>
            <Link
              href={`/production-orders/${order.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              <Plus size={16} />
              Відкрити створення партії
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
