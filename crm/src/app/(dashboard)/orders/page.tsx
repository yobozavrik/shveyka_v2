'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  X,
  Loader2,
  ArrowRight,
  Database
} from 'lucide-react';
import Link from 'next/link';

type ProductionOrder = {
  id: number;
  order_number: string;
  order_type: 'stock' | 'customer';
  status: string;
  total_quantity: number;
  created_at: string;
  base_models?: { name: string };
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [baseModels, setBaseModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    order_type: 'stock',
    base_model_id: '',
    total_quantity: '',
  });

  useEffect(() => {
    fetchOrders();
    loadBaseModels();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production-orders');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadBaseModels = async () => {
    try {
      const res = await fetch('/api/catalog/base-models');
      const data = await res.json();
      setBaseModels(data);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.base_model_id) return alert('Оберіть базову модель');
    
    setLoading(true);
    try {
      const res = await fetch('/api/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          total_quantity: Number(form.total_quantity) || 0,
          status: 'draft' // Статус Нове
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ order_type: 'stock', base_model_id: '', total_quantity: '' });
        fetchOrders();
      }
    } catch (e) { alert('Помилка при створенні замовлення'); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            Виробничі замовлення
          </h1>
          <p className="text-gray-500 mt-1 text-sm font-medium uppercase tracking-wider">Управління планами та партіями</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all active:scale-95"
        >
          <Plus size={20} />
          Створити замовлення
        </button>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
        ) : orders.map(o => (
          <Link 
            key={o.id} 
            href={`/production-orders/${o.id}`} 
            className="group p-6 bg-white border border-gray-100 rounded-[32px] hover:shadow-2xl hover:shadow-gray-200/50 transition-all flex flex-col justify-between min-h-[180px]"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-sm font-bold text-gray-400 group-hover:text-blue-600 transition-colors">#{o.order_number}</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-200">
                  {o.status === 'draft' ? 'Нове' : o.status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
                {o.base_models?.name || 'Без моделі'}
                <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-all" />
              </h3>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-sm">
              <span className="text-gray-400 font-medium">План: <b className="text-gray-900">{o.total_quantity} шт</b></span>
              <span className="text-[10px] text-gray-300 font-bold uppercase">{new Date(o.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Modal: New Order */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 space-y-8 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Нове замовлення</h2>
                <p className="text-xs text-gray-400 font-black uppercase tracking-widest mt-1">Крок 1: Планування бази</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Місце призначення</label>
                <div className="flex gap-3">
                  {[
                    { id: 'stock', label: 'На склад' },
                    { id: 'customer', label: 'Замовнику' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm({...form, order_type: t.id as any})}
                      className={`flex-1 py-4 rounded-2xl border-2 font-bold text-sm transition-all ${
                        form.order_type === t.id 
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg shadow-blue-500/10' 
                        : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Базова модель (конструктив)</label>
                <select 
                  value={form.base_model_id}
                  onChange={e => setForm({...form, base_model_id: e.target.value})}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-gray-900 appearance-none cursor-pointer shadow-inner"
                  required
                >
                  <option value="">Оберіть модель вирібу</option>
                  {baseModels.map(bm => <option key={bm.id} value={bm.id}>{bm.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Загальна кількість (план)</label>
                <div className="relative">
                  <input 
                    type="number"
                    min="1"
                    placeholder="Напр: 100"
                    value={form.total_quantity}
                    onChange={e => setForm({...form, total_quantity: e.target.value})}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none font-black text-xl text-blue-600 shadow-inner"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 font-bold uppercase text-[10px]">одиниць</span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-bold text-lg hover:bg-blue-700 shadow-2xl shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Зафіксувати замовлення'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
