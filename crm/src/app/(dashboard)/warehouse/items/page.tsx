'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, Search, Loader2, AlertTriangle, Package2, X, 
  MoreVertical, Edit3, Trash2, Filter, Download, Info, Scale, Box
} from 'lucide-react';

interface Item {
  id: number;
  sku: string | null;
  name: string;
  item_type: string;
  unit: string;
  current_stock: number;
  min_stock?: number;
  price_per_unit?: number | null;
  has_batches: boolean;
  notes: string | null;
}

const TYPE_MAP: Record<string, { label: string; color: string; icon: any }> = {
  raw_material: { label: 'Сировина', color: 'bg-sky-500/10 text-sky-500', icon: Scale },
  finished_good: { label: 'Готова Продукція', color: 'bg-emerald-500/10 text-emerald-500', icon: Package2 },
  component: { label: 'Компонент', color: 'bg-amber-500/10 text-amber-500', icon: Box },
  fabric: { label: 'Тканина', color: 'bg-sky-500/10 text-sky-500', icon: Scale },
  other: { label: 'Інше', color: 'bg-[var(--bg-card2)] text-[var(--text-2)]', icon: Info },
};

const EMPTY_FORM = { 
  sku: '', 
  name: '', 
  item_type: 'raw_material', 
  unit: 'м', 
  price_per_unit: '',
  has_batches: false,
  notes: ''
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/items');
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch (e) {
      console.error('Failed to load items:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/warehouse/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price_per_unit: form.price_per_unit ? parseFloat(form.price_per_unit as string) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(m => 
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.sku && m.sku.toLowerCase().includes(search.toLowerCase()))
    );
  }, [items, search]);

  return (
    <div className="flex gap-6 h-full border-t border-transparent">
      {/* Table Section */}
      <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm flex flex-col overflow-hidden">
        
        {/* Actions bar */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Пошук за назвою або SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-card2)] border border-transparent rounded-2xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-3">
             <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[var(--border)] text-sm font-bold text-[var(--text-2)] hover:bg-[var(--bg-card2)] transition-all">
                <Filter className="h-4 w-4" /> Фільтри
             </button>
             <button 
                onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-sm"
              >
                <Plus className="h-4 w-4" /> Створити Номенклатуру
             </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-3)]">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="font-bold">Завантаження...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-3)] py-12">
              <Package2 className="h-16 w-16 mb-4 opacity-10" />
              <p className="text-lg font-bold italic">Нічого не знайдено</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[var(--bg-card)]/80 backdrop-blur-md border-b border-[var(--border)] z-10">
                <tr className="text-[var(--text-3)] text-[10px] font-black uppercase tracking-widest bg-[var(--bg-base)]">
                  <th className="px-6 py-4">Товар / SKU</th>
                  <th className="px-6 py-4">Тип товару</th>
                  <th className="px-6 py-4">Загальний Склад</th>
                  <th className="px-6 py-4 text-center">Партії</th>
                  <th className="px-6 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/50">
                {filteredItems.map(m => {
                  const type = TYPE_MAP[m.item_type] || TYPE_MAP.other;
                  return (
                    <tr 
                      key={m.id} 
                      onClick={() => setSelectedItem(m)}
                      className={`group hover:bg-indigo-500/5 transition-all cursor-pointer ${selectedItem?.id === m.id ? 'bg-indigo-500/5' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-base)]`}>
                            <type.icon className={`h-4 w-4 text-slate-400`} />
                          </div>
                          <div>
                            <div className="font-black text-[var(--text-1)] group-hover:text-indigo-600 transition-colors">{m.name}</div>
                            <div className="text-[10px] font-mono text-[var(--text-3)] uppercase">{m.sku || 'NO-SKU'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`${type.color} text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider`}>
                          {type.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-end gap-1.5">
                          <span className={`text-lg font-black leading-none text-[var(--text-1)]`}>
                            {m.current_stock?.toFixed(2) || '0'}
                          </span>
                          <span className="text-[10px] font-bold text-[var(--text-3)] uppercase pb-0.5">{m.unit}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         {m.has_batches ? (
                           <span className="text-[10px] font-bold uppercase text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">Так</span>
                         ) : (
                           <span className="text-[10px] font-bold uppercase text-slate-400">Ні</span>
                         )}
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-1 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-3)] transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

       {/* Right Detail Sidepanel */}
       <div className={`w-[350px] bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-xl p-6 flex flex-col gap-6 transition-all duration-300 ${selectedItem ? 'translate-x-0' : 'translate-x-4 opacity-50 opacity-0 pointer-events-none absolute right-0'}`}>
        {selectedItem && (
          <div className="flex flex-col gap-6 h-full overflow-auto custom-scrollbar">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-widest text-indigo-500 uppercase">Деталі номенклатури</span>
              <button onClick={() => setSelectedItem(null)} className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[var(--text-1)]">{selectedItem.name}</h2>
              <p className="text-xs font-mono text-[var(--text-3)]">{selectedItem.sku || 'БЕЗ SKU'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-base)] p-4 rounded-2xl border border-[var(--border)]">
                <p className="text-[9px] font-black text-[var(--text-3)] uppercase mb-1">Загальний Склад</p>
                <p className="text-lg font-black text-[var(--text-1)]">
                   {selectedItem.current_stock?.toFixed(2) || '0'} <span className="text-xs text-[var(--text-3)]">{selectedItem.unit}</span>
                </p>
              </div>
              <div className="bg-[var(--bg-base)] p-4 rounded-2xl border border-[var(--border)]">
                <p className="text-[9px] font-black text-[var(--text-3)] uppercase mb-1">Ціна</p>
                <p className="text-lg font-bold text-[var(--text-1)] text-ellipsis">
                   {selectedItem.price_per_unit || '—'}
                </p>
              </div>
            </div>

            {selectedItem.has_batches && (
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                 <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Увага</p>
                 <p className="text-xs text-indigo-500">Товар ведеться в розрізі партій/рулонів (Lot/Batch Tracking активно).</p>
              </div>
            )}

            <div className="bg-[var(--bg-base)] border border-[var(--border)] p-4 rounded-[24px]">
              <h4 className="flex items-center gap-2 text-[10px] font-black text-[var(--text-3)] uppercase mb-3 leading-none">
                <Info className="h-3 w-3" /> Примітки
              </h4>
              <p className="text-xs text-[var(--text-2)] leading-relaxed italic">
                {selectedItem.notes || 'Додаткова інформація відсутня.'}
              </p>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 pb-2 pt-4">
              <button className="flex items-center justify-center gap-2 border border-[var(--border)] hover:bg-[var(--bg-card2)] py-3 rounded-2xl text-xs font-bold transition-all">
                <Edit3 className="h-4 w-4" /> Редагувати
              </button>
              <button className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-3 rounded-2xl text-xs font-bold transition-all border border-red-500/20">
                <Trash2 className="h-4 w-4" /> Видалити
              </button>
            </div>
          </div>
        )}
      </div>

       {/* Modal Create Item */}
       {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[32px] p-8 w-full max-w-lg shadow-2xl space-y-6 overflow-auto max-h-[90vh] custom-scrollbar">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-[var(--text-1)]">Нова Номенклатура</h3>
                <p className="text-[var(--text-3)] text-xs font-medium">Реєстрація товару, сировини або матеріалу</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 focus-within:transform focus-within:translate-x-1 transition-transform">
                  <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">SKU / Артикул</label>
                  <input 
                    value={form.sku} 
                    onChange={e => setForm(f => ({...f, sku: e.target.value}))}
                    className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono"
                    placeholder="FAB-1025" 
                  />
                </div>
                <div className="space-y-1.5 focus-within:transform focus-within:translate-x-1 transition-transform">
                  <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Тип Товару</label>
                  <select 
                    value={form.item_type} 
                    onChange={e => setForm(f => ({...f, item_type: e.target.value}))}
                    className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-bold appearance-none select-custom"
                  >
                    {Object.entries(TYPE_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 focus-within:transform focus-within:translate-y-[-2px] transition-transform">
                <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Повна назва</label>
                <input 
                  value={form.name} 
                  onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-black text-lg"
                  placeholder="Кулір Пеньє Білий 210г" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Од. виміру</label>
                  <input 
                    value={form.unit} 
                    onChange={e => setForm(f => ({...f, unit: e.target.value}))}
                    className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all font-bold"
                    placeholder="м, шт, кг" 
                  />
                </div>
                <div className="space-y-1.5 flex items-center pt-6 ml-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                     <input 
                        type="checkbox"
                        checked={form.has_batches}
                        onChange={e => setForm(f => ({...f, has_batches: e.target.checked}))}
                        className="w-5 h-5 rounded-md border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
                     />
                     <span className="text-sm font-bold text-[var(--text-1)]">Партионний облік</span>
                  </label>
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
                onClick={handleSave} 
                disabled={saving || !form.name}
                className="flex-[3] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-[20px] text-sm font-black transition-all flex items-center justify-center gap-3"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        .select-custom { background-image: url("data:image/svg+xml,%3Csvg stroke='%2394a3b8' stroke-width='2' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-position: right 1rem center; background-repeat: no-repeat; background-size: 1.25rem; }
      `}</style>
    </div>
  );
}
