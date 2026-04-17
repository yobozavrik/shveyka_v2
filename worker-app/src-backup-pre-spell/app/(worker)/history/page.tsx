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
    <div className="px-4 py-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black">Моя робота</h2>
          <p className="text-[var(--text-2)] text-xs mt-0.5">Останні 30 записів</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2.5 bg-[var(--bg-card2)] rounded-xl"
        >
          <RefreshCw className={clsx('w-5 h-5 text-[var(--text-2)]', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-16 text-[var(--text-3)]">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Поки немає записів</p>
        </div>
      )}

      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayEntries]) => (
          <div key={date} className="mb-5">
            <div className="text-xs font-black text-[var(--text-2)] uppercase tracking-wider mb-2">
              {new Date(date + 'T12:00:00').toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="space-y-2">
              {dayEntries.map((entry) => {
                const conf = STATUS_CONF[entry.status] || STATUS_CONF.submitted;
                const StatusIcon = conf.icon;
                return (
                  <div key={entry.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm truncate">
                            {entry.operations?.name || 'Операція'}
                          </span>
                          {entry.size && (
                            <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
                              <Tag className="w-3 h-3" />
                              {entry.size}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-2)]">
                          <span className="font-mono text-emerald-300">
                            {entry.production_batches?.batch_number}
                          </span>
                          <span>·</span>
                          <span className={clsx('flex items-center gap-1 font-semibold', conf.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {conf.label}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="mt-1 text-xs text-[var(--text-3)] italic">{entry.notes}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <div>
                          <div className="text-2xl font-black">{entry.quantity}</div>
                          <div className="text-xs text-[var(--text-3)]">шт</div>
                        </div>
                        {entry.status === 'submitted' && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-2 text-[var(--text-3)] active:text-red-400 bg-[var(--bg-card2)] rounded-lg"
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
    </div>
  );
}

