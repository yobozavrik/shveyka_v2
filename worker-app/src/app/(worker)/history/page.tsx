'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, Tag, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface Entry {
  id: number;
  quantity: number;
  size: string | null;
  status: string;
  entry_date: string;
  entry_time: string;
  notes: string | null;
  created_at: string;
  operations: { id: number; name: string; code: string; operation_type: string } | null;
  production_batches: { id: number; batch_number: string } | null;
}

const STATUS_CONF: Record<string, { label: string; color: string; icon: any }> = {
  submitted: { label: 'Очікує',   color: 'text-amber-400',  icon: Clock },
  confirmed: { label: 'Підтверджено', color: 'text-green-400', icon: CheckCircle2 },
  rejected:  { label: 'Відхилено', color: 'text-red-400',   icon: AlertCircle },
};

export default function HistoryPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mobile/entries?limit=30');
      if (res.ok) setEntries(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей запис?')) return;
    
    try {
      const res = await fetch(`/api/mobile/entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Помилка при видаленні');
      }
    } catch (err) {
      alert('Помилка мережі при видаленні');
    }
  };

  useEffect(() => { load(); }, [load]);

  // Group by date
  const grouped: Record<string, Entry[]> = {};
  for (const e of entries) {
    const d = e.entry_date || e.created_at.slice(0, 10);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  }

  return (
    <div className="px-4 py-8 safe-area-top">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-1)] tracking-tight">Історія</h2>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-3)] mt-1 ml-1">
            Останні 30 операцій
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-3 glass-muted rounded-2xl text-[var(--text-2)] hover:text-emerald-500 transition-colors"
        >
          <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="rounded-[2.5rem] border border-dashed border-[var(--border)] glass-muted px-8 py-20 text-center text-[var(--text-3)]">
          <Clock className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-black text-[var(--text-1)]">Записів не знайдено</p>
        </div>
      )}

      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayEntries]) => (
          <div key={date} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
               <div className="h-[1px] flex-1 bg-[var(--border)] opacity-30" />
               <div className="text-[10px] font-black text-[var(--text-3)] uppercase tracking-[0.2em] whitespace-nowrap">
                  {new Date(date + 'T12:00:00').toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })}
               </div>
               <div className="h-[1px] flex-1 bg-[var(--border)] opacity-30" />
            </div>
            
            <div className="space-y-4">
              {dayEntries.map((entry) => {
                const conf = STATUS_CONF[entry.status] || STATUS_CONF.submitted;
                const StatusIcon = conf.icon;
                return (
                  <div key={entry.id} className="glass rounded-[2rem] p-5 border border-white/5 shadow-xl shadow-black/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-base font-black text-[var(--text-1)] tracking-tight truncate leading-tight">
                            {entry.operations?.name || 'Операція'}
                          </span>
                          {entry.size && (
                            <span className="rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] px-2 py-0.5 font-black uppercase tracking-wider border border-emerald-500/10">
                              {entry.size}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-[var(--text-3)]">
                          <span className="font-mono text-emerald-500 bg-emerald-500/5 px-1.5 py-0.5 rounded">
                            {entry.production_batches?.batch_number}
                          </span>
                          <span className="opacity-30">•</span>
                          <span className={clsx('flex items-center gap-1.5 uppercase tracking-widest text-[9px] font-black', conf.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {conf.label}
                          </span>
                        </div>
                        {entry.notes && (
                          <div className="mt-3 p-3 rounded-xl glass-muted text-[11px] text-[var(--text-2)] font-medium leading-relaxed italic border border-white/5">
                            {entry.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-3">
                        <div className="glass shadow-inset px-4 py-2 rounded-2xl border border-white/5 bg-white/5 min-w-[60px] text-center">
                          <div className="text-2xl font-black text-[var(--text-1)] tracking-tighter leading-none">{entry.quantity}</div>
                          <div className="text-[9px] font-black uppercase text-[var(--text-3)] tracking-widest mt-1">шт</div>
                        </div>
                        {entry.status === 'submitted' && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-2.5 text-[var(--text-3)] hover:text-red-500 glass-muted rounded-xl transition-colors active:scale-90 border border-white/5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      <div className="h-24" />
    </div>

  );
}

