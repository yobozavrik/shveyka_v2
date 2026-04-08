'use client';

import { useEffect, useState } from 'react';
import { showConfirm } from '@/lib/confirm';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, Eye, FileText, Loader2, Package, Play, RefreshCw, Search, XCircle } from 'lucide-react';

type ProductionOrder = {
  id: number;
  order_number: string;
  order_type: 'stock' | 'customer';
  customer_name: string | null;
  target_location_id?: number | null;
  target_location?: {
    id: number;
    name: string;
    type: string;
  } | null;
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
  model_name: string;
  model_sku: string | null;
  size?: string | null;
  quantity: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Чернетка',
  approved: 'Затверджено',
  launched: 'Запущено',
  in_production: 'У виробництві',
  in_progress: 'Виконується',
  completed: 'Завершено',
  closed: 'Закрито',
  cancelled: 'Скасовано',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  launched: 'bg-green-100 text-green-700',
  in_production: 'bg-green-100 text-green-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
};

export default function ProductionOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter || 'launched,in_production,in_progress,completed,closed');
      const res = await fetch(`/api/production-orders?${params.toString()}`);
      if (!res.ok) throw new Error('Помилка завантаження');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
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

  const filteredOrders = orders.filter((order) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      order.order_number.toLowerCase().includes(q) ||
      order.customer_name?.toLowerCase().includes(q) ||
      order.lines.some((line) => line.model_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            Виробничі замовлення
          </h1>
          <p className="text-sm text-gray-500 mt-1">Планування випуску продукції</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Оновити
          </button>
          <Link
            href="/orders?tab=orders"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            <Eye size={16} />
            Переглянути замовлення
          </Link>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Пошук за номером або замовником..."
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
          <option value="draft">Чернетки</option>
          <option value="approved">Затверджені</option>
          <option value="launched">Запущені</option>
          <option value="completed">Завершені</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
          Завантаження...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            {search || statusFilter ? 'Нічого не знайдено' : 'Немає замовлень'}
          </p>
          {!search && !statusFilter && (
            <Link
              href="/orders?tab=orders"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Eye size={16} />
              Переглянути замовлення
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/production-orders/${order.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(`/production-orders/${order.id}`);
                }
              }}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${STATUS_COLOR[order.status] || 'bg-gray-100'}`}>
                    <FileText className={`h-6 w-6 ${order.status === 'in_progress' ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-gray-900">{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[order.status]}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                      {order.priority === 'urgent' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {order.order_type === 'customer' ? (
                        <span>Замовник: {order.customer_name || 'Не вказано'}</span>
                      ) : (
                        <span>На склад: {order.target_location?.name || 'не вказано'}</span>
                      )}
                      <span className="mx-2">•</span>
                      <span>{new Date(order.order_date).toLocaleDateString('uk-UA')}</span>
                      {order.planned_completion_date && (
                        <>
                          <span className="mx-2">•</span>
                          <span>План: {new Date(order.planned_completion_date).toLocaleDateString('uk-UA')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right mr-4">
                    <div className="text-2xl font-bold text-gray-900">{order.total_quantity}</div>
                    <div className="text-xs text-gray-500">{order.total_lines} позицій</div>
                  </div>

                  {order.status === 'draft' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(order.id);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
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
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                    >
                      <Play size={16} />
                      Запустити
                    </button>
                  )}

                  <Link
                    href={`/production-orders/${order.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    <Eye size={18} />
                  </Link>
                </div>
              </div>

              {order.lines && order.lines.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {order.lines.slice(0, 6).map((line) => (
                      <div key={line.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <div className="font-medium text-gray-800 truncate">{line.model_name || 'Модель'}</div>
                        <div className="text-xs text-gray-500 flex items-center justify-between">
                          <span>{line.size || '—'}</span>
                          <span className="font-semibold text-gray-700">{line.quantity} шт</span>
                        </div>
                      </div>
                    ))}
                    {order.lines.length > 6 && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex items-center justify-center text-gray-500">
                        +{order.lines.length - 6} ще
                      </div>
                    )}
                  </div>
                </div>
              )}

              {order.notes && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">{order.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
