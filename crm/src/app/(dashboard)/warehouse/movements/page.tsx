'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeftRight, Loader2, Plus, Search, MapPin, Package2, AlertTriangle, X
} from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface LedgerEntry {
  id: number;
  transaction_date: string;
  qty: number;
  reference_type: string;
  comment: string;
  items: { id: number; name: string; sku: string; unit: string };
  source: { id: number; name: string };
  target: { id: number; name: string };
}

export default function MovementsPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
     item_id: '',
     source_location_id: '',
     target_location_id: '',
     qty: '',
     comment: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [movRes, locRes, itemRes] = await Promise.all([
        fetch('/api/warehouse/movements'),
        fetch('/api/warehouse/locations'),
        fetch('/api/warehouse/items')
      ]);
      const [movData, locData, itemData] = await Promise.all([
         movRes.json(), locRes.json(), itemRes.json()
      ]);
      if (Array.isArray(movData)) setEntries(movData);
      if (Array.isArray(locData)) setLocations(locData);
      if (Array.isArray(itemData)) setItems(itemData);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!form.item_id || !form.source_location_id || !form.target_location_id || !form.qty) {
       setError("Заповніть всі обов'язкові поля!");
       return;
    }
    
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/warehouse/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           item_id: parseInt(form.item_id),
           source_location_id: parseInt(form.source_location_id),
           target_location_id: parseInt(form.target_location_id),
           qty: parseFloat(form.qty),
           comment: form.comment
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка при створенні руху');
      
      setShowModal(false);
      setForm({ item_id: '', source_location_id: '', target_location_id: '', qty: '', comment: ''});
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = entries.filter(e => 
    e.items?.name.toLowerCase().includes(search.toLowerCase()) || 
    e.source?.name.toLowerCase().includes(search.toLowerCase()) ||
    e.target?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-6 h-full border-t border-transparent">
      {/* Table Section */}
      <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Пошук по товару або складу..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-card2)] border border-transparent rounded-2xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all font-medium"
            />
          </div>
          <button 
             onClick={() => setShowModal(true)}
             className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-sm"
          >
             <Plus className="h-4 w-4" /> Створити Переміщення
          </button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-3)]">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="font-bold">Завантаження журналу...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-3)] py-12">
               <ArrowLeftRight className="h-16 w-16 mb-4 opacity-10" />
               <p className="text-lg font-bold italic">Журнал порожній</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[var(--bg-card)]/80 backdrop-blur-md border-b border-[var(--border)] z-10">
                <tr className="text-[var(--text-3)] text-[10px] font-black uppercase tracking-widest bg-[var(--bg-base)]">
                  <th className="px-6 py-4">Дата / Час</th>
                  <th className="px-6 py-4">Товар</th>
                  <th className="px-6 py-4">Рух (Source → Target)</th>
                  <th className="px-6 py-4 text-right">Кількість</th>
                  <th className="px-6 py-4">Коментар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-indigo-500/5 transition-all">
                    <td className="px-6 py-4">
                       <p className="text-sm font-bold text-[var(--text-1)]">{format(new Date(entry.transaction_date), 'dd MMM yyyy', { locale: uk })}</p>
                       <p className="text-[10px] text-[var(--text-3)] font-mono">{format(new Date(entry.transaction_date), 'HH:mm')}</p>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <Package2 className="h-4 w-4 text-[var(--text-3)]" />
                          <div>
                            <p className="text-sm font-bold text-[var(--text-1)]">{entry.items?.name}</p>
                            <p className="text-[10px] text-[var(--text-3)] font-mono">{entry.items?.sku || '-'}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col gap-1.5 justify-center">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-2)]">
                             <MapPin className="h-3 w-3 text-red-500" />
                             {entry.source?.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-2)]">
                             <MapPin className="h-3 w-3 text-emerald-500" />
                             {entry.target?.name}
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="inline-flex items-end gap-1 px-3 py-1 bg-[var(--bg-base)] rounded-xl border border-[var(--border)]">
                          <span className="text-lg font-black font-mono text-indigo-600">{entry.qty}</span>
                          <span className="text-[10px] text-[var(--text-3)] font-bold pb-0.5">{entry.items?.unit}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                       <p className="text-xs text-[var(--text-2)] italic truncate" title={entry.comment || entry.reference_type}>
                          {entry.comment || entry.reference_type}
                       </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

       {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[32px] p-8 w-full max-w-lg shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-[var(--text-1)]">Переміщення</h3>
                <p className="text-[var(--text-3)] text-xs font-medium">Double-Entry Транзакція</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all">
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-bold italic animate-shake">
                <AlertTriangle className="h-5 w-5" /> {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5 focus-within:transform focus-within:translate-x-1 transition-transform">
                <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Товар / Номенклатура</label>
                <select 
                  value={form.item_id} 
                  onChange={e => setForm(f => ({...f, item_id: e.target.value}))}
                  className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 font-bold appearance-none"
                >
                  <option value="">Оберіть товар...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku || 'Без артикулу'})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-red-500 font-black uppercase tracking-tighter ml-1">Звідки (Source)</label>
                  <select 
                    value={form.source_location_id} 
                    onChange={e => setForm(f => ({...f, source_location_id: e.target.value}))}
                    className="w-full bg-red-50/50 border border-red-200 text-red-900 rounded-2xl px-4 py-3 text-sm outline-none focus:border-red-500 font-bold appearance-none"
                  >
                    <option value="">Склад-відправник...</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-emerald-500 font-black uppercase tracking-tighter ml-1">Куди (Target)</label>
                  <select 
                    value={form.target_location_id} 
                    onChange={e => setForm(f => ({...f, target_location_id: e.target.value}))}
                    className="w-full bg-emerald-50/50 border border-emerald-200 text-emerald-900 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-500 font-bold appearance-none"
                  >
                    <option value="">Склад-одержувач...</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5 focus-within:transform focus-within:translate-x-1 transition-transform">
                   <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Кількість (Завжди додатня)</label>
                   <input 
                     type="number"
                     value={form.qty} 
                     onChange={e => setForm(f => ({...f, qty: e.target.value}))}
                     className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 font-mono font-bold"
                     placeholder="0.00" 
                   />
                 </div>
                 <div className="space-y-1.5 focus-within:transform focus-within:translate-x-1 transition-transform">
                   <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Коментар</label>
                   <input 
                     value={form.comment} 
                     onChange={e => setForm(f => ({...f, comment: e.target.value}))}
                     className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 font-medium"
                     placeholder="Причина переміщення..." 
                   />
                 </div>
               </div>

            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-[1] bg-[var(--bg-base)] border border-[var(--border)] hover:bg-[var(--bg-card2)] py-4 rounded-[20px] text-sm font-black transition-all"
              >
                Скасувати
              </button>
              <button 
                onClick={handleCreate} 
                disabled={saving}
                className="flex-[3] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-[20px] text-sm font-black transition-all flex items-center justify-center gap-3"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowLeftRight className="h-5 w-5" />}
                Провести Транзакцію
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
      `}</style>
    </div>
  );
}
