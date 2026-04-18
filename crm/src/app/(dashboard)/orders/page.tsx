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
  MapPin,
  UserPlus,
  ChevronDown
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
  base_model_id: number | null;
  category_id: number | null;
};

type BaseModel = {
  id: number;
  name: string;
  category_id: number | null;
};

type OrderItem = {
  id: string;
  category_id: string;
  base_model_id: string;
  model_id: string; // Это и есть финальное исполнение (вариация)
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

export default function OrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<ProductModel[]>([]); // Это вариации
  const [baseModels, setBaseModels] = useState<BaseModel[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFillCard, setShowFillCard] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  // Справочники
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: number; name: string; phone?: string }[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '' });

  const [form, setForm] = useState({
    order_type: 'warehouse',
    planned_completion_date: '',
    target_location_id: '',
    client_id: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
  });
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pRes, bRes, cRes, lRes, clRes] = await Promise.all([
        fetch('/api/product-models?source=keycrm'),
        fetch('/api/catalog/base-models'),
        fetch('/api/catalog/categories'),
        fetch('/api/warehouse/locations'),
        fetch('/api/clients')
      ]);

      const [p, b, c, l, cl] = await Promise.all([
        pRes.json(), bRes.json(), cRes.json(), lRes.json(), clRes.json()
      ]);

      setProducts(p);
      setBaseModels(b);
      
      const flatten = (list: any[]): any[] => {
        let res: any[] = [];
        list.forEach(i => {
          res.push(i);
          if (i.children) res = res.concat(flatten(i.children));
        });
        return res;
      };
      setCategories(flatten(c));
      setLocations(l);
      setClients(cl);
    } catch (e) {
      console.error('Data load error', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('status', statusFilter || 'draft,approved');
      const res = await fetch(`/api/production-orders?${params}`);
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

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        category_id: '',
        base_model_id: '',
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
      target_location_id: '',
      client_id: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
    });
    setItems([]);
    setEditingOrderId(null);
  };

  const handleSubmitOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.some(i => !i.model_id)) {
      alert('Будь ласка, оберіть вариацію для всіх позицій');
      return;
    }

    setLoading(true);
    try {
      const lines = items.map((item) => {
        const product = products.find((p) => p.id === Number(item.model_id));
        return {
          model_id: Number(item.model_id),
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
          customer_name: form.customer_name || null,
          customer_phone: form.customer_phone || null,
          planned_completion_date: form.planned_completion_date || null,
          lines,
        }),
      });

      if (res.ok) {
        setShowFillCard(false);
        resetOrderForm();
        fetchOrders();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <FileText className="h-7 w-7 text-blue-600" />
            Замовлення
          </h1>
          <p className="mt-1 text-sm text-gray-500">Створення та управління виробничими потоками</p>
        </div>
        <button
          onClick={() => setShowFillCard(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} />
          Сформувати замовлення
        </button>
      </div>

      {/* Main Grid View Placeholder */}
      <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400">
        <Package size={48} className="mx-auto mb-4 opacity-20" />
        <p>Виберіть вкладку або створіть нове замовлення</p>
      </div>

      {/* Order Form Modal */}
      {showFillCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900">Нове виробниче замовлення</h3>
              <button onClick={() => { setShowFillCard(false); resetOrderForm(); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Step 1: Destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Тип замовлення</label>
                  <div className="flex gap-3">
                    {['warehouse', 'customer'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({...form, order_type: t})}
                        className={`flex-1 py-3 px-4 rounded-2xl border-2 transition-all font-semibold text-sm ${
                          form.order_type === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                        }`}
                      >
                        {t === 'warehouse' ? 'На склад' : 'Замовнику'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Дата виконання</label>
                  <input
                    type="date"
                    value={form.planned_completion_date}
                    onChange={(e) => setForm({...form, planned_completion_date: e.target.value})}
                    className="w-full py-3 px-4 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-blue-500/5 outline-none font-medium"
                  />
                </div>
              </div>

              {/* Step 2: Models Selection - THE MAGIC PART */}
              <div className="space-y-6 pt-4 border-t border-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Shirt className="text-blue-600" size={20} />
                    Склад замовлення
                  </h4>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <Plus size={16} /> Додати виріб
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item) => {
                    const filteredBase = item.category_id 
                      ? baseModels.filter(b => b.category_id === Number(item.category_id))
                      : baseModels;
                    
                    const filteredVariations = item.base_model_id
                      ? products.filter(p => p.base_model_id === Number(item.base_model_id))
                      : [];

                    return (
                      <div key={item.id} className="relative p-6 rounded-3xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-xl hover:shadow-gray-200/40 transition-all group">
                        <button 
                          type="button" 
                          onClick={() => removeItem(item.id)}
                          className="absolute -top-2 -right-2 w-8 h-8 bg-white shadow-md border border-gray-100 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Category */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Категорія</label>
                            <select
                              value={item.category_id}
                              onChange={(e) => {
                                updateItem(item.id, 'category_id', e.target.value);
                                updateItem(item.id, 'base_model_id', '');
                                updateItem(item.id, 'model_id', '');
                              }}
                              className="w-full p-3 rounded-xl border border-gray-100 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                            >
                              <option value="">Всі категорії</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>

                          {/* Base Model */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Модель (Базова)</label>
                            <select
                              disabled={!item.category_id}
                              value={item.base_model_id}
                              onChange={(e) => {
                                updateItem(item.id, 'base_model_id', e.target.value);
                                updateItem(item.id, 'model_id', '');
                              }}
                              className="w-full p-3 rounded-xl border border-gray-100 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 outline-none disabled:opacity-50 appearance-none cursor-pointer"
                            >
                              <option value="">{item.category_id ? `Оберіть модель (${filteredBase.length})` : 'Спочатку категорію'}</option>
                              {filteredBase.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                          </div>

                          {/* Variation */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Виконання (Тканина/Колір)</label>
                            <select
                              disabled={!item.base_model_id}
                              value={item.model_id}
                              onChange={(e) => updateItem(item.id, 'model_id', e.target.value)}
                              className="w-full p-3 rounded-xl border border-gray-100 bg-white text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none disabled:opacity-50 appearance-none cursor-pointer"
                            >
                              <option value="">{item.base_model_id ? `Оберіть вариацію (${filteredVariations.length})` : 'Оберіть базу'}</option>
                              {filteredVariations.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.name.replace(baseModels.find(b => b.id === Number(item.base_model_id))?.name || '', '').trim() || 'Стандарт'}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Quantity Row */}
                        <div className="mt-4 flex items-center gap-4 pt-4 border-t border-gray-100/50">
                           <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-500">Загальна кількість:</span>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                className="w-24 p-2 rounded-lg border border-gray-200 text-center font-bold text-gray-900 focus:border-blue-500 outline-none"
                              />
                           </div>
                           {item.model_id && (
                             <div className="text-[10px] text-gray-400 italic">
                               * Буде розгорнуто за розмірною сіткою при створенні партій
                             </div>
                           )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => { setShowFillCard(false); resetOrderForm(); }}
                  className="flex-1 py-4 px-6 rounded-2xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={loading || items.length === 0}
                  className="flex-[2] py-4 px-6 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : (editingOrderId ? 'Зберегти зміни' : 'Створити виробниче замовлення')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
