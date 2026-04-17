'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserCheck, Loader2, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Tag, Clock
} from 'lucide-react';
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
    <div className="px-4 py-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-400" />
            Підтвердження
          </h2>
          <p className="text-[var(--text-2)] text-xs mt-0.5">{entries.length} очікують</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2.5 bg-[var(--bg-card2)] rounded-xl">
          <RefreshCw className={clsx('w-5 h-5 text-[var(--text-2)]', loading && 'animate-spin')} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-4 mb-4 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-16 text-[var(--text-3)]">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500/40" />
          <p className="font-semibold">Все підтверджено!</p>
          <p className="text-xs mt-1">Нових записів немає</p>
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry) => {
          const isProcessing = processing[entry.id];
          const earnings = ((entry.operations?.base_rate || 0) * entry.quantity).toFixed(2);

          return (
            <div key={entry.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
              {/* Worker + time */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-sm">{entry.employees?.full_name}</p>
                  <p className="text-xs text-[var(--text-2)]">{entry.employees?.position}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-[var(--text-3)]">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(entry.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Operation + batch */}
              <div className="bg-[var(--bg-card2)]/60 rounded-xl p-3 mb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold">{entry.operations?.name}</p>
                    <p className="text-xs text-emerald-300 font-mono mt-0.5">
                      {entry.production_batches?.batch_number}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">{entry.quantity}</p>
                    <p className="text-xs text-[var(--text-2)]">шт</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {entry.size && (
                    <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
                      <Tag className="w-3 h-3" /> {entry.size}
                    </span>
                  )}
                  <span className="text-xs text-[var(--text-2)]">= {earnings} грн</span>
                </div>

                {entry.notes && (
                  <p className="mt-2 text-xs text-[var(--text-2)] italic">💬 {entry.notes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction(entry.id, 'confirm')}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 active:bg-green-500/40
                             border border-green-500/30 text-green-400 font-bold py-3 rounded-xl transition-colors
                             disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Підтвердити
                </button>
                <button
                  onClick={() => handleAction(entry.id, 'reject')}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 active:bg-red-500/20
                             border border-red-500/20 text-red-400 font-bold py-3 rounded-xl transition-colors
                             disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Відхилити
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

