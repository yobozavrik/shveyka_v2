'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';

interface PendingEntry {
  id: number;
  quantity: number;
  size: string | null;
  status: string;
  entry_date: string;
  entry_time: string;
  notes: string | null;
  created_at: string;
  employees: { id: number; full_name: string; position: string } | null;
  operations: { id: number; name: string; code: string; base_rate: number } | null;
  production_batches: {
    id: number;
    batch_number: string;
    product_models: { id: number; name: string } | null;
  } | null;
}

export default function MasterPage() {
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mobile/master/pending');
      if (res.status === 403) { setError('Немає прав майстра'); return; }
      if (!res.ok) throw new Error('Помилка завантаження');
      setEntries(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (entryId: number, action: 'confirm' | 'reject') => {
    setProcessing((p) => ({ ...p, [entryId]: true }));
    try {
      const res = await fetch('/api/mobile/master/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId, action }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
      }
    } finally {
      setProcessing((p) => ({ ...p, [entryId]: false }));
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      {/* ─── Bento Stats ─── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container-low p-4 rounded-[24px] flex flex-col justify-between">
          <span className="material-symbols-outlined text-primary text-2xl">pending_actions</span>
          <div>
            <p className="text-3xl font-black text-on-surface leading-tight">{entries.length}</p>
            <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest">Очікують</p>
          </div>
        </div>
        <div className="bg-primary/5 p-4 rounded-[24px] flex flex-col justify-between border border-primary/10">
          <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
          <div>
            <p className="text-3xl font-black text-primary leading-tight">98%</p>
            <p className="text-[10px] font-bold text-primary/50 uppercase tracking-widest">Якість зміну</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-black text-on-surface uppercase tracking-widest">Черга підтвердження</h2>
        <button 
          onClick={load} 
          disabled={loading}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container active:scale-90 transition-all"
        >
          <span className={clsx("material-symbols-outlined text-xl", loading && "animate-spin")}>refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-[24px] bg-error/10 border border-error/20 flex items-center gap-3 text-error">
          <span className="material-symbols-outlined">warning</span>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
          <span className="material-symbols-outlined text-6xl animate-pulse">hourglass_empty</span>
          <p className="font-bold uppercase tracking-widest text-xs">Завантаження...</p>
        </div>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-4xl filled">check_circle</span>
          </div>
          <div>
            <p className="font-black text-xl">Все підтверджено!</p>
            <p className="text-on-surface-variant/60 text-sm">Нових записів у черзі немає</p>
          </div>
        </div>
      )}

      {/* ─── Approval List ─── */}
      <div className="flex flex-col gap-4">
        {entries.map((entry) => {
          const isProcessing = processing[entry.id];
          const earnings = ((entry.operations?.base_rate || 0) * entry.quantity).toFixed(2);
          
          return (
            <div key={entry.id} className="bg-white dark:bg-surface-container-lowest rounded-[28px] p-5 shadow-sm border border-outline-variant/10 flex flex-col gap-4">
              {/* Worker Info */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-black text-sm">
                    {entry.employees?.full_name?.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface leading-tight">{entry.employees?.full_name}</h3>
                    <p className="text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-tighter">
                      {entry.employees?.position} • {new Date(entry.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[12px] font-black">
                  ₴ {earnings}
                </div>
              </div>

              {/* Operation Details */}
              <div className="bg-surface-container-low rounded-[20px] p-4 border border-outline-variant/5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none mb-1">Партія {entry.production_batches?.batch_number}</span>
                    <span className="font-black text-on-surface leading-tight">{entry.operations?.name}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-black text-primary leading-none">{entry.quantity}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase">шт.</span>
                  </div>
                </div>
                
                {entry.size && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">straighten</span>
                    <span className="text-xs font-bold text-on-surface-variant">Розмір: {entry.size}</span>
                  </div>
                )}
                
                {entry.notes && (
                  <p className="mt-2 text-xs italic text-on-surface-variant/70 border-t border-outline-variant/5 pt-2">
                    "{entry.notes}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAction(entry.id, 'reject')}
                  disabled={isProcessing}
                  className="h-14 rounded-[20px] bg-error/5 text-error border border-error/10 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">block</span>
                  Відхилити
                </button>
                <button
                  onClick={() => handleAction(entry.id, 'confirm')}
                  disabled={isProcessing}
                  className="h-14 rounded-[20px] bg-primary text-white shadow-lg shadow-primary/20 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="material-symbols-outlined animate-spin">sync</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">check_circle</span>
                      Підтвердити
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
