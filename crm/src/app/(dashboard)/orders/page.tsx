'use client';

import { type FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  ChevronDown,
  FileText,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';

type ProductionOrder = {
  id: number;
  order_number: string;
  order_type: 'stock' | 'customer';
  status: string;
  total_quantity: number;
  planned_completion_date?: string | null;
  created_at: string;
  base_models?: { name: string };
};

type OrderLineItem = {
  id: string;
  base_model_id: string;
  quantity: string;
};

function OrdersContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'orders';

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [baseModels, setBaseModels] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [form, setForm] = useState({
    order_type: 'stock',
    planned_completion_date: '',
  });
  const [items, setItems] = useState<OrderLineItem[]>([
    { id: 'line-1', base_model_id: '', quantity: '1' },
  ]);

  useEffect(() => {
    void fetchOrders();
    void loadCatalogData();
  }, [activeTab]);

  useEffect(() => {
    if (!showForm) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowForm(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [showForm]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/production-orders?tab=${activeTab}`);
      const text = await res.text();
      if (!res.ok) {
        console.error('fetchOrders failed:', res.status, text);
        setOrders([]);
        return;
      }
      const data = text ? JSON.parse(text) : [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchOrders error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogData = async () => {
    try {
      const bRes = await fetch('/api/catalog/base-models');
      const bData = await bRes.json();
      setBaseModels(Array.isArray(bData) ? bData : []);
    } catch (e) {
      console.error('loadCatalogData error:', e);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.base_model_id);
    if (validItems.length === 0) return;

    const uniqueModels = [...new Set(validItems.map((i) => i.base_model_id))];
    if (uniqueModels.length > 1) {
      alert('Зараз API підтримує одне замовлення на одну модель. Залиште одну модель у списку.');
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
        }),
      });

      if (res.ok) {
        resetForm();
        await fetchOrders();
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !search ||
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (order.base_models?.name || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-[#f5f6f8] px-6 py-7">
      <div className="mx-auto max-w-[1248px] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[38px] leading-[42px] font-bold flex items-center gap-3 text-[#111827]">
              <FileText className="h-8 w-8 text-[#2563eb]" />
              Замовлення
            </h1>
            <p className="text-[#6b7280] mt-1">Планування випуску продукції</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void fetchOrders()}
              className="h-10 px-5 border border-[#d1d5db] rounded-lg text-[#374151] hover:bg-[#f9fafb] inline-flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Оновити
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="h-10 px-5 bg-[#2563eb] rounded-lg text-white font-semibold hover:bg-[#1d4ed8] inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Заповнити замовлення
            </button>
          </div>
        </div>

        {showForm && (
          <div
            className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px] p-6 overflow-y-auto"
            onClick={() => setShowForm(false)}
          >
            <div
              className="mx-auto mt-8 max-w-[1120px] border border-[#d1d5db] rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[34px] font-semibold text-[#111827]">Заповнення замовлення</h2>
              <button onClick={() => setShowForm(false)} className="text-[#9ca3af] hover:text-[#6b7280]">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
                  <div className="text-[#111827] font-semibold inline-flex items-center gap-2">
                    <Package size={14} />
                    МОДЕЛІ
                  </div>
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
                        <div className="relative">
                          <select
                            value={item.base_model_id}
                            onChange={(e) => updateItem(item.id, { base_model_id: e.target.value })}
                            className="h-10 w-full rounded-md border border-[#d1d5db] bg-white px-3 pr-8 text-sm appearance-none"
                            required
                          >
                            <option value="">Оберіть модель</option>
                            {baseModels.map((bm) => (
                              <option key={bm.id} value={bm.id}>
                                {bm.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280]" size={14} />
                        </div>
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

        <div className="flex items-center gap-3">
          <div className="relative w-[340px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
            <input
              type="text"
              placeholder="Пошук..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#d1d5db] bg-white pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm"
          >
            <option value="all">Всі статуси</option>
            <option value="draft">Чернетка</option>
            <option value="approved">Затверджено</option>
            <option value="in_progress">В роботі</option>
            <option value="completed">Завершено</option>
          </select>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="animate-spin text-[#2563eb] mx-auto" size={28} />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-10 text-center text-[#6b7280] border border-dashed rounded-lg bg-white">
              Замовлень не знайдено
            </div>
          ) : (
            filteredOrders.map((order) => (
              <Link
                key={order.id}
                href={`/production-orders/${order.id}`}
                className="block rounded-lg border border-[#e5e7eb] bg-white p-4 hover:bg-[#f9fafb]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#111827]">#{order.order_number}</div>
                    <div className="text-sm text-[#6b7280]">{order.base_models?.name || 'Без моделі'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[#111827] font-medium">{order.total_quantity} шт</div>
                    <div className="text-xs text-[#6b7280]">{order.status}</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
