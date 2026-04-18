'use client';

import { type FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { showConfirm } from '@/lib/confirm';

type ProductionOrder = {
  id: number;
  order_number: string;
  order_type: 'stock' | 'customer';
  status: string;
  total_quantity: number;
  total_lines?: number;
  created_at: string;
  planned_completion_date?: string | null;
  base_models?: { name: string } | null;
};

type OrderLineItem = {
  id: string;
  base_model_id: string;
  quantity: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Чернетка',
  approved: 'Затверджено',
  launched: 'Запущено',
  in_production: 'У виробництві',
  in_progress: 'В роботі',
  completed: 'Завершено',
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
  closed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [baseModels, setBaseModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [form, setForm] = useState({
    order_type: 'stock',
    planned_completion_date: '',
  });
  const [items, setItems] = useState<OrderLineItem[]>([
    { id: 'line-1', base_model_id: '', quantity: '1' },
  ]);

  useEffect(() => {
    void fetchOrders();
    void loadBaseModels();
  }, [statusFilter]);

  useEffect(() => {
    if (!showModal) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [showModal]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/production-orders?${params.toString()}`);
      if (!res.ok) throw new Error('Помилка завантаження');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBaseModels = async () => {
    try {
      const res = await fetch('/api/catalog/base-models');
      const data = await res.json();
      setBaseModels(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setBaseModels([]);
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), base_model_id: '', quantity: '1' }]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const updateItem = (id: string, patch: Partial<OrderLineItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const resetForm = () => {
    setForm({
      order_type: 'stock',
      planned_completion_date: '',
    });
    setItems([{ id: 'line-1', base_model_id: '', quantity: '1' }]);
  };

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.base_model_id);
    if (validItems.length === 0) return;

    const uniqueModels = [...new Set(validItems.map((i) => i.base_model_id))];
    if (uniqueModels.length > 1) {
      alert('Зараз API підтримує одне замовлення на одну модель.');
      return;
    }

    const totalQuantity = validItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

    setSaving(true);
    try {
      const res = await fetch('/api/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: form.order_type,
          planned_completion_date: form.planned_completion_date || null,
          base_model_id: Number(uniqueModels[0]),
          total_quantity: totalQuantity,
          status: 'draft',
        }),
      });

      if (!res.ok) throw new Error('Помилка створення');
      setShowModal(false);
      resetForm();
      await fetchOrders();
    } catch (e) {
      console.error(e);
      alert('Помилка при створенні замовлення');
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async (orderId: number) => {
    if (!(await showConfirm('Запустити замовлення у виробництво? Це створить партії.'))) return;
    try {
      const res = await fetch(`/api/production-orders/${orderId}/launch`, { method: 'POST' });
      if (!res.ok) throw new Error('Помилка запуску');
      await fetchOrders();
    } catch (e) {
      console.error(e);
      alert('Не вдалося запустити замовлення');
    }
  };

  const handleDelete = async (orderId: number) => {
    if (!(await showConfirm('Видалити замовлення?'))) return;
    try {
      const res = await fetch(`/api/production-orders/${orderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Помилка видалення');
      await fetchOrders();
    } catch (e) {
      console.error(e);
      alert('Не вдалося видалити замовлення');
    }
  };

  const filteredOrders = orders.filter((order) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      order.order_number.toLowerCase().includes(q) ||
      (order.base_models?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            Замовлення
          </h1>
          <p className="text-gray-500 mt-1">Планування випуску продукції</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchOrders()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Оновити
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
          >
            <Plus className="h-4 w-4" />
            Заповнити замовлення
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Пошук..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Всі статуси</option>
          <option value="draft">Чернетка</option>
          <option value="approved">Затверджено</option>
          <option value="launched">Запущено</option>
          <option value="in_progress">В роботі</option>
          <option value="completed">Завершено</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-600'}`}>
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-2xl text-gray-900">{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {order.order_type === 'customer' ? 'Замовнику' : 'На склад'}
                      <span className="mx-2">•</span>
                      Створено: {new Date(order.created_at).toLocaleDateString('uk-UA')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right mr-2">
                    <div className="text-4xl leading-none font-bold text-gray-900">{order.total_quantity}</div>
                    <div className="text-sm text-gray-500">{order.total_lines || 1} позицій</div>
                  </div>

                  {order.status === 'approved' && (
                    <button
                      onClick={() => void handleLaunch(order.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                    >
                      <Play size={16} />
                      Запустити
                    </button>
                  )}

                  <Link href={`/production-orders/${order.id}`} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md" title="Редагувати">
                    <Pencil size={18} />
                  </Link>
                  <button
                    onClick={() => void handleDelete(order.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    title="Видалити"
                  >
                    <Trash2 size={18} />
                  </button>
                  <Link href={`/production-orders/${order.id}`} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md" title="Переглянути">
                    <Eye size={18} />
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {filteredOrders.length === 0 && (
            <div className="text-center py-10 text-gray-500 border border-dashed rounded-lg">Замовлень не знайдено</div>
          )}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px] p-6 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="mx-auto mt-8 max-w-[1120px] border border-[#d1d5db] rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[34px] font-semibold text-[#111827]">Заповнення замовлення</h2>
              <button onClick={() => setShowModal(false)} className="text-[#9ca3af] hover:text-[#6b7280]">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateOrder(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-2">ТИП ЗАМОВЛЕННЯ</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, order_type: 'stock' }))}
                    className={`h-11 rounded-lg border text-left px-4 ${
                      form.order_type === 'stock'
                        ? 'border-[#2563eb] bg-[#eff6ff] text-[#1e3a8a]'
                        : 'border-[#d1d5db] text-[#111827]'
                    }`}
                  >
                    На склад
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, order_type: 'customer' }))}
                    className={`h-11 rounded-lg border text-left px-4 ${
                      form.order_type === 'customer'
                        ? 'border-[#2563eb] bg-[#eff6ff] text-[#1e3a8a]'
                        : 'border-[#d1d5db] text-[#111827]'
                    }`}
                  >
                    Замовнику
                  </button>
                </div>
              </div>

              <div className="max-w-sm">
                <label className="block text-xs font-semibold text-[#374151] mb-2">ДАТА, КОЛИ ТРЕБА ВИКОНАТИ</label>
                <div className="relative">
                  <input
                    type="date"
                    value={form.planned_completion_date}
                    onChange={(e) => setForm((p) => ({ ...p, planned_completion_date: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-[#d1d5db] px-3 pr-10 text-sm"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={14} />
                </div>
              </div>

              <div className="border-t border-[#e5e7eb] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[#111827] font-semibold">МОДЕЛІ</div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="h-8 px-3 rounded-md bg-[#ecfdf5] text-[#059669] text-sm font-medium border border-[#d1fae5] inline-flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Додати модель
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#d1d5db] bg-[#f9fafb] p-2">
                      <div className="grid grid-cols-[1fr_160px] gap-2">
                        <select
                          value={item.base_model_id}
                          onChange={(e) => updateItem(item.id, { base_model_id: e.target.value })}
                          className="h-10 w-full rounded-md border border-[#d1d5db] bg-white px-3 text-sm"
                          required
                        >
                          <option value="">Оберіть модель</option>
                          {baseModels.map((bm) => (
                            <option key={bm.id} value={bm.id}>
                              {bm.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                          className="h-10 rounded-md border border-[#d1d5db] bg-white px-3 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="mt-1 text-xs text-[#ef4444] inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        Видалити
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#e5e7eb] pt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-10 rounded-md border border-[#d1d5db] text-[#111827] font-medium"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-md bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] disabled:opacity-60"
                >
                  {saving ? 'Збереження...' : 'Створити замовлення'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
