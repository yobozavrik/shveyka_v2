'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { showConfirm } from '@/lib/confirm';
import { useRouter } from 'next/navigation';
import {
  FileText,
  RefreshCw,
  Package,
  AlertTriangle,
  CheckCircle,
  Play,
  XCircle,
  Loader2,
  Search,
  Eye,
  Edit2,
  Plus,
  X,
  Trash2,
  Shirt,
} from 'lucide-react';
import Link from 'next/link';

type ProductionOrder = {
  id: number;
  order_number: string;
  order_type: 'stock' | 'customer';
  customer_name: string | null;
  status: string;
  priority: string;
  order_date: string;
  planned_completion_date: string | null;
  total_quantity: number;
  total_lines: number;
  notes: string | null;
  created_at: string;
  lines: OrderLine[];
};

type OrderLine = {
  id: number;
  model_id: number | null;
  model_name: string;
  model_sku: string | null;
  size?: string | null;
  quantity: number;
  notes?: string | null;
};

type ProductModel = {
  id: number;
  sku: string;
  name: string;
  is_active: boolean;
};

type OrderItem = {
  id: string;
  model_id: string;
  quantity: string;
};

const PROD_STATUS_LABEL: Record<string, string> = {
  draft: 'Чернетка',
  approved: 'Затверджено',
  launched: 'Запущено',
  in_production: 'У виробництві',
  in_progress: 'Виконується',
  completed: 'Завершено',
  closed: 'Закрито',
  cancelled: 'Скасовано',
};

const PROD_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-600',
  launched: 'bg-green-100 text-green-600',
  in_production: 'bg-green-100 text-green-700',
  in_progress: 'bg-orange-100 text-orange-600',
  completed: 'bg-emerald-100 text-emerald-600',
  closed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
};

const PROD_STATUS_ICON: Record<string, any> = {
  draft: FileText,
  approved: CheckCircle,
  launched: Play,
  in_progress: Loader2,
  completed: CheckCircle,
  closed: XCircle,
  cancelled: XCircle,
};

export default function OrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<ProductModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFillCard, setShowFillCard] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  const [form, setForm] = useState({
    order_type: 'warehouse',
    planned_completion_date: '',
  });
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch('/api/product-models?source=keycrm');
        if (res.ok) {
          const data = await res.json();
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error('Error loading products:', e);
      }
    };

    loadProducts();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      } else {
        params.append('status', 'draft,approved');
      }

      const res = await fetch(`/api/production-orders?${params}`);
      if (!res.ok) throw new Error('Помилка завантаження');
      const data = await res.json();
      setOrders(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleApprove = async (orderId: number) => {
    try {
      const res = await fetch(`/api/production-orders/${orderId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Помилка затвердження');
      await fetchOrders();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleLaunch = async (orderId: number) => {
    if (!await showConfirm('Запустити замовлення у виробництво? Це створить партії.')) return;
    try {
      const res = await fetch(`/api/production-orders/${orderId}/launch`, { method: 'POST' });
      if (!res.ok) throw new Error('Помилка запуску');
      await fetchOrders();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        model_id: '',
        quantity: '1',
      },
    ]);
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const resetOrderForm = () => {
    setForm({
      order_type: 'warehouse',
      planned_completion_date: '',
    });
    setItems([]);
    setEditingOrderId(null);
  };

  const startCreateOrder = () => {
    resetOrderForm();
    setShowFillCard(true);
  };

  const startEditOrder = (order: ProductionOrder) => {
    setEditingOrderId(order.id);
    setForm({
      order_type: order.order_type === 'customer' ? 'customer' : 'warehouse',
      planned_completion_date: order.planned_completion_date || '',
    });
    setItems(
      (order.lines || []).map((line) => ({
        id: `${order.id}-${line.id}-${Math.random().toString(36).slice(2, 8)}`,
        model_id: line.model_id ? String(line.model_id) : '',
        quantity: String(line.quantity),
      })),
    );
    setShowFillCard(true);
  };

  const handleDeleteOrder = async (order: ProductionOrder) => {
    const label = `№${order.order_number}`;
    if (!await showConfirm(`Видалити замовлення ${label}?`)) return;

    try {
      const res = await fetch(`/api/production-orders/${order.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Помилка видалення');
      }
      await fetchOrders();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Додайте хоча б одну модель');
      return;
    }

    setLoading(true);
    try {
      const lines = items.map((item) => {
        const product = products.find((p) => p.id === Number(item.model_id));
        return {
          model_id: Number(item.model_id) || null,
          model_name: product?.name || '',
          model_sku: product?.sku || '',
          quantity: Number(item.quantity) || 1,
        };
      });

      const endpoint = editingOrderId ? `/api/production-orders/${editingOrderId}` : '/api/production-orders';
      const res = await fetch(endpoint, {
        method: editingOrderId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: form.order_type === 'customer' ? 'customer' : 'stock',
          planned_completion_date: form.planned_completion_date || null,
          lines,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || (editingOrderId ? 'Помилка збереження' : 'Помилка створення'));
      }

      setShowFillCard(false);
      resetOrderForm();
      await fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      !search ||
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <FileText className="h-7 w-7 text-blue-600" />
            Замовлення
          </h1>
          <p className="mt-1 text-sm text-gray-500">Планування випуску продукції</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Оновити
          </button>
          <button
            onClick={() => (showFillCard && editingOrderId === null ? setShowFillCard(false) : startCreateOrder())}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            {showFillCard && editingOrderId !== null ? 'Редагування' : 'Заповнити замовлення'}
          </button>
        </div>
      </div>

      {showFillCard && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">{editingOrderId ? 'Редагування замовлення' : 'Заповнення замовлення'}</h3>
            <button
              onClick={() => {
                setShowFillCard(false);
                resetOrderForm();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmitOrder} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Тип замовлення</label>
              <div className="grid grid-cols-2 gap-3">
                {(['warehouse', 'customer'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, order_type: type })}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${
                      form.order_type === type
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-900">
                      {type === 'warehouse' ? 'На склад' : 'Замовнику'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Дата, коли треба виконати</label>
              <input
                type="date"
                value={form.planned_completion_date}
                onChange={(e) => setForm({ ...form, planned_completion_date: e.target.value })}
                className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="border-t pt-4">
              <div className="mb-3 flex items-center justify-between">
                <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
                  <Shirt size={14} /> Моделі
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 rounded bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20"
                >
                  <Plus size={14} /> Додати модель
                </button>
              </div>

              {items.length === 0 ? (
                <div className="rounded bg-gray-50 py-6 text-center text-gray-500">Моделей не обрано</div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={item.model_id}
                          onChange={(e) => updateItem(item.id, 'model_id', e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Оберіть модель</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                          placeholder="К-сть"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={12} /> Видалити
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowFillCard(false);
                  resetOrderForm();
                }}
                className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={loading || items.length === 0}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Збереження...' : editingOrderId ? 'Зберегти зміни' : 'Створити замовлення'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Пошук..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Всі статуси</option>
          <option value="draft">Чернетки</option>
          <option value="approved">Затверджені</option>
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-gray-500">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
          Завантаження...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">{search || statusFilter ? 'Нічого не знайдено' : 'Немає замовлень'}</p>
          {!search && !statusFilter && (
            <button
              onClick={() => setShowFillCard(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Створити перше замовлення
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => router.push(`/production-orders/${order.id}`)}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      PROD_STATUS_COLOR[order.status] || 'bg-gray-100'
                    }`}
                  >
                    {(() => {
                      const Icon = PROD_STATUS_ICON[order.status] || FileText;
                      return <Icon className={`h-6 w-6 ${order.status === 'in_progress' ? 'animate-spin' : ''}`} />;
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">{order.order_number}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PROD_STATUS_COLOR[order.status]}`}>
                        {PROD_STATUS_LABEL[order.status] || order.status}
                      </span>
                      {order.priority === 'urgent' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="mt-0.5 text-sm text-gray-500">
                      {order.order_type === 'customer' ? (
                        <span>Замовник: {order.customer_name || 'Не вказано'}</span>
                      ) : (
                        <span>На склад</span>
                      )}
                      <span className="mx-2">•</span>
                      <span>Створено: {new Date(order.order_date).toLocaleDateString('uk-UA')}</span>
                      {order.planned_completion_date && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Потрібно до: {new Date(order.planned_completion_date).toLocaleDateString('uk-UA')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="mr-4 text-right">
                    <div className="text-2xl font-bold text-gray-900">{order.total_quantity}</div>
                    <div className="text-xs text-gray-500">{order.total_lines} позицій</div>
                  </div>

                  {order.status === 'draft' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(order.id);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <CheckCircle size={16} />
                      Затвердити
                    </button>
                  )}

                  {order.status === 'approved' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunch(order.id);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                    >
                      <Play size={16} />
                      Запустити
                      </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditOrder(order);
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Редагувати"
                  >
                    <Edit2 size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteOrder(order);
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Видалити"
                  >
                    <Trash2 size={18} />
                  </button>

                  <Link
                    href={`/production-orders/${order.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Eye size={18} />
                  </Link>
                </div>
              </div>

              {order.lines && order.lines.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {order.lines.slice(0, 6).map((line) => (
                      <div key={line.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <div className="truncate font-medium text-gray-800">{line.model_name || 'Модель'}</div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{line.size || '—'}</span>
                          <span className="font-semibold text-gray-700">{line.quantity} шт</span>
                        </div>
                      </div>
                    ))}
                    {order.lines.length > 6 && (
                      <div className="flex items-center justify-center rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        +{order.lines.length - 6} ще
                      </div>
                    )}
                  </div>
                </div>
              )}

              {order.notes && (
                <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">{order.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
