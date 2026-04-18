'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Loader2, 
  Plus, 
  RefreshCw, 
  X,
  Shirt,
  Scissors,
  Play,
  Trash2,
  CheckCircle2,
  Layers
} from 'lucide-react';

type FabricItem = {
  color: string;
  rolls: number;
  planned_qty: number;
};

type ProductionOrder = {
  id: number;
  order_number: string;
  order_type: 'stock' | 'customer';
  status: 'draft' | 'approved' | 'launched' | 'completed' | 'cancelled';
  base_model_id: number | null;
  base_models?: { name: string };
  total_quantity: number;
  batches: any[];
};

export default function ProductionOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const router = useRouter();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBatchModal, setShowBatchModal] = useState(false);
  
  const [dna, setDna] = useState<{fabrics: string[], colors: string[]}>({ fabrics: [], colors: [] });
  const [baseSizes, setBaseSizes] = useState<string[]>([]);
  
  const [batchForm, setBatchForm] = useState({
    fabric_type: '',
    selected_sizes: [] as string[],
    fabric_items: [] as FabricItem[]
  });

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/production-orders/${orderId}`);
      const data = await res.json();
      setOrder(data);
      
      if (data.base_model_id) {
        const dnaRes = await fetch(`/api/catalog/model-dna?baseModelId=${data.base_model_id}`);
        const dnaData = await dnaRes.json();
        setDna(dnaData);

        if (dnaData.raw?.[0]) {
          const sizeRes = await fetch(`/api/catalog/products/${dnaData.raw[0].id}`);
          const sizeData = await sizeRes.json();
          setBaseSizes(sizeData.variants?.map((v: any) => v.size) || []);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const addFabricItem = () => {
    setBatchForm(prev => ({
      ...prev,
      fabric_items: [...prev.fabric_items, { color: '', rolls: 1, planned_qty: 0 }]
    }));
  };

  const removeFabricItem = (index: number) => {
    setBatchForm(prev => ({
      ...prev,
      fabric_items: prev.fabric_items.filter((_, i) => i !== index)
    }));
  };

  const updateFabricItem = (index: number, field: keyof FabricItem, value: any) => {
    const next = [...batchForm.fabric_items];
    next[index] = { ...next[index], [field]: value };
    setBatchForm(prev => ({ ...prev, fabric_items: next }));
  };

  const toggleSize = (size: string) => {
    setBatchForm(prev => ({
      ...prev,
      selected_sizes: prev.selected_sizes.includes(size) 
        ? prev.selected_sizes.filter(s => s !== size)
        : [...prev.selected_sizes, size]
    }));
  };

  const handleLaunch = async () => {
    if (!confirm('Запустити замовлення у виробництво?')) return;
    await fetch(`/api/production-orders/${orderId}/launch`, { method: 'POST' });
    fetchOrder();
  };

  const handleCreateBatch = async () => {
    try {
      const res = await fetch(`/api/production-orders/${orderId}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabric_type: batchForm.fabric_type,
          selected_sizes: batchForm.selected_sizes,
          fabric_items: batchForm.fabric_items,
          status: 'created'
        })
      });

      if (res.ok) {
        setShowBatchModal(false);
        setBatchForm({ fabric_type: '', selected_sizes: [], fabric_items: [] });
        fetchOrder();
      }
    } catch (e) { alert('Помилка при створенні партії'); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!order) return <div className="p-8 text-center text-gray-500">Замовлення не знайдено</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* Header Panel */}
      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link href="/orders" className="w-12 h-12 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-gray-900">{order.order_number}</h1>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                {order.status === 'draft' ? 'Нове' : order.status}
              </span>
            </div>
            <p className="text-gray-400 font-bold text-sm mt-1 uppercase">
              База: <span className="text-gray-900">{order.base_models?.name}</span> · План: <span className="text-gray-900">{order.total_quantity} шт</span>
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {order.status === 'draft' && (
            <button onClick={handleLaunch} className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-500/20">
              <Play size={20} /> Запустити в роботу
            </button>
          )}
          {(order.status === 'launched' || order.status === 'approved') && (
            <button onClick={() => setShowBatchModal(true)} className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20">
              <Plus size={20} /> Створити партію
            </button>
          )}
        </div>
      </div>

      {/* Batches Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {order.batches?.map(b => (
          <div key={b.id} className="bg-white p-7 rounded-[32px] border border-gray-100 shadow-sm group">
            <div className="flex justify-between items-start mb-6">
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                {b.status === 'created' ? 'Нова' : b.status}
              </div>
              <span className="font-mono text-xs font-bold text-gray-300 group-hover:text-blue-400 transition-colors">#{b.batch_number}</span>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-gray-900 font-bold">
                <Layers size={18} className="text-gray-300" />
                <span>{b.fabric_type}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(b.selected_sizes || []).map((s: string) => (
                  <span key={s} className="px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-black border border-gray-100">{s}</span>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-50 grid grid-cols-1 gap-2">
                {(b.fabric_items || []).map((item: FabricItem, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-600">{item.color}</span>
                    <span className="text-gray-400">{item.rolls} рл. · <b className="text-gray-900">{item.planned_qty} шт</b></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: New Batch */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[40px] w-full max-w-3xl p-10 space-y-8 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="flex justify-between items-center bg-gray-50/50 -m-10 p-10 mb-0 border-b border-gray-100">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-[20px] bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                  <Scissors size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Формування партії</h2>
                  <p className="text-xs text-blue-600 font-black uppercase tracking-widest mt-0.5">Крок 2: Параметри тканини</p>
                </div>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="p-3 hover:bg-gray-100 rounded-full"><X size={28} className="text-gray-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-10 pr-2 pt-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Тип тканини</label>
                <select 
                  value={batchForm.fabric_type}
                  onChange={e => setBatchForm({...batchForm, fabric_type: e.target.value})}
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-gray-900 shadow-inner"
                >
                  <option value="">Оберіть полотно</option>
                  {dna.fabrics.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between ml-2">
                  <label className="text-[10px] font-black uppercase text-gray-400">Кольори та Кількість</label>
                  <button onClick={addFabricItem} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors">
                    <Plus size={14} /> Додати колір
                  </button>
                </div>
                <div className="space-y-3">
                  {batchForm.fabric_items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                      <div className="col-span-5">
                        <select 
                          value={item.color}
                          onChange={e => updateFabricItem(index, 'color', e.target.value)}
                          className="w-full p-3 bg-white border-none rounded-xl text-sm font-bold shadow-sm"
                        >
                          <option value="">Колір...</option>
                          {dna.colors.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3 relative">
                        <input 
                          type="number"
                          placeholder="Рл."
                          value={item.rolls || ''}
                          onChange={e => updateFabricItem(index, 'rolls', Number(e.target.value))}
                          className="w-full p-3 bg-white border-none rounded-xl text-sm font-bold text-center shadow-sm"
                        />
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-300 uppercase">Рулони</span>
                      </div>
                      <div className="col-span-3 relative">
                        <input 
                          type="number"
                          placeholder="Шт."
                          value={item.planned_qty || ''}
                          onChange={e => updateFabricItem(index, 'planned_qty', Number(e.target.value))}
                          className="w-full p-3 bg-white border-none rounded-xl text-sm font-black text-center text-blue-600 shadow-sm"
                        />
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-black text-gray-300 uppercase">План</span>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeFabricItem(index)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-50">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Розміри для цієї партії</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {baseSizes.map(s => {
                    const active = batchForm.selected_sizes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSize(s)}
                        className={`p-4 rounded-[20px] font-black text-sm transition-all border-2 flex flex-col items-center gap-2 ${
                          active 
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg shadow-blue-500/10' 
                          : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        {s}
                        {active && <CheckCircle2 size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-50 flex gap-4">
               <button onClick={() => setShowBatchModal(false)} className="flex-1 py-5 bg-gray-100 text-gray-500 rounded-[24px] font-bold">Скасувати</button>
               <button onClick={handleCreateBatch} disabled={!batchForm.fabric_type || batchForm.fabric_items.length === 0 || batchForm.selected_sizes.length === 0} className="flex-[2] py-5 bg-blue-600 text-white rounded-[24px] font-bold text-lg hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50">Підтвердити та надіслати на розкрій</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
