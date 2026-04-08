'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, MapPin, Search, FolderTree, Info } from 'lucide-react';

interface Location {
  id: number;
  name: string;
  type: string;
  parent_id: number | null;
}

const TYPE_BADGES: Record<string, { label: string, color: string }> = {
  internal: { label: 'Фізичний склад', color: 'bg-emerald-100 text-emerald-700' },
  vendor: { label: 'Постачальник', color: 'bg-indigo-100 text-indigo-700' },
  customer: { label: 'Клієнт (Відвантаження)', color: 'bg-amber-100 text-amber-700' },
  production: { label: 'Цех (НЗП)', color: 'bg-sky-100 text-sky-700' },
  inventory_loss: { label: 'Брак/Списання', color: 'bg-red-100 text-red-700' },
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/locations');
      const data = await res.json();
      if (Array.isArray(data)) setLocations(data);
    } catch (e) {
      console.error('Error fetching locations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex gap-6 h-full border-t border-transparent">
      <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Пошук складської локації..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-card2)] border border-transparent rounded-2xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-3">
             {/* В майбутньому тут кнопочка для додавання локації */}
             <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[var(--border)] text-sm font-bold text-[var(--text-2)] hover:bg-[var(--bg-card2)] transition-all">
                <FolderTree className="h-4 w-4" /> Дерево Локацій
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-6">
           <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-2xl mb-6 flex items-start gap-4">
               <Info className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
               <div>
                  <h4 className="text-sm font-bold text-sky-800 dark:text-sky-400 mb-1">Віртуальні та Фізичні зони</h4>
                  <p className="text-xs text-sky-700/80 dark:text-sky-300/80 leading-relaxed font-medium">Складський облік Odoo вимагає, щоб будь-який рух фіксувався. Закупівля сировини – це рух з "Постачальник" на "Внутрішній склад". Передача в цех – рух з "Внутрішній склад" на "Цех (НЗП)". Тому ви бачите тут не лише фізичні склади, але й транзитні зони.</p>
               </div>
           </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center text-[var(--text-3)] py-12">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="font-bold">Завантаження...</p>
            </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {filtered.map(loc => {
                 const badge = TYPE_BADGES[loc.type] || { label: loc.type, color: 'bg-slate-100 text-slate-700' };
                 return (
                   <div key={loc.id} className="border border-[var(--border)] bg-[var(--bg-base)] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                     <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
                           <MapPin className="h-5 w-5 text-indigo-500" />
                        </div>
                        <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-1 rounded-lg ${badge.color}`}>
                           {badge.label}
                        </span>
                     </div>
                     <h3 className="font-black text-lg text-[var(--text-1)]">{loc.name}</h3>
                     <p className="text-xs text-[var(--text-3)] font-mono mt-1 pt-1 border-t border-[var(--border)]">ID: {loc.id} {loc.parent_id ? `| Parent: ${loc.parent_id}` : ''}</p>
                   </div>
                 );
               })}
             </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
      `}</style>
    </div>
  );
}
