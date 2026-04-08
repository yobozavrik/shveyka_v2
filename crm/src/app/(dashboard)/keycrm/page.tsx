'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, Package, ClipboardCheck,
  CircleDollarSign, RefreshCw, ShoppingCart, CheckCircle, XCircle, Loader2, Clock
} from 'lucide-react';

type SyncLog = {
  id: number;
  orders_fetched: number;
  batches_created: number;
  errors: string | null;
  status: string;
  synced_at: string;
};

const statusIcon: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-green-400" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
};

export default function KeyCRMPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; orders_fetched?: number; batches_created?: number; created?: number; updated?: number } | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/keycrm/sync-log');
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/keycrm/sync', { method: 'POST' });
      const data = await res.json();
      setResult(data);
      fetchLogs();
    } catch (e) {
      setResult({ error: String(e) });
    }
    setSyncing(false);
  };

  const handleCatalogSync = async () => {
    setCatalogSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/keycrm/products/sync', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: String(e) });
    }
    setCatalogSyncing(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-purple-400" /> KeyCRM Інтеграція
          </h1>
          <p className="text-[var(--text-2)] text-sm mt-1">Синхронізація замовлень з KeyCRM → виробничі партії</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCatalogSync}
            disabled={catalogSyncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-card)] hover:bg-black/8 dark:hover:bg-white/8 disabled:opacity-50 rounded-xl text-sm font-bold transition-all border border-[var(--border)]"
          >
            {catalogSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {catalogSyncing ? 'Синхронізація товарів...' : 'Синхронізувати Товари'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-bold transition-all"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'Синхронізація замовлень...' : 'Синхронізувати Замовлення'}
          </button>
        </div>
      </div>

      {/* Sync result */}
      {result && (
        <div className={`p-4 rounded-2xl border ${result.success ? 'bg-green-400/5 border-green-400/20' : 'bg-red-400/5 border-red-400/20'}`}>
          {result.success ? (
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div>
                <span className="font-bold text-green-400">Успішно!</span>
                {result.orders_fetched !== undefined ? (
                    <span className="text-[var(--text-1)] ml-2">Замовлень: {result.orders_fetched}, нових партій: {result.batches_created}</span>
                ) : (
                    <span className="text-[var(--text-1)] ml-2">Синхронізовано моделей: {result.created} створено, {result.updated} оновлено</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-400" />
              <span className="text-red-400">{result.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Stats cards */}
      {logs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-2xl p-5">
            <div className="text-xs text-[var(--text-2)] mb-1">Всього синхронізацій</div>
            <div className="text-2xl font-black">{logs.length}</div>
          </div>
          <div className="bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-2xl p-5">
            <div className="text-xs text-[var(--text-2)] mb-1">Остання синхронізація</div>
            <div className="text-lg font-bold">{new Date(logs[0].synced_at).toLocaleString('uk-UA')}</div>
          </div>
          <div className="bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-2xl p-5">
            <div className="text-xs text-[var(--text-2)] mb-1">Успішних</div>
            <div className="text-2xl font-black text-green-400">{logs.filter(l => l.status === 'success').length}</div>
          </div>
        </div>
      )}

      {/* Logs table */}
      <div>
        <h2 className="text-lg font-bold mb-3">Історія синхронізацій</h2>
        {loading ? (
          <div className="text-center py-8 text-[var(--text-2)]">Завантаження...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-slate-700 mx-auto mb-3" />
            <p className="text-[var(--text-2)]">Ще не було синхронізацій</p>
          </div>
        ) : (
          <div className="bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-center px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Статус</th>
                  <th className="text-left px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Дата</th>
                  <th className="text-center px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Замовлення</th>
                  <th className="text-center px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Нових партій</th>
                  <th className="text-left px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Помилки</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--border)]/50 hover:bg-black/5 dark:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-center">{statusIcon[log.status] || <Clock className="h-4 w-4 text-[var(--text-2)] inline" />}</td>
                    <td className="px-4 py-3">{new Date(log.synced_at).toLocaleString('uk-UA')}</td>
                    <td className="px-4 py-3 text-center font-bold">{log.orders_fetched}</td>
                    <td className="px-4 py-3 text-center font-bold text-indigo-400">{log.batches_created}</td>
                    <td className="px-4 py-3 text-xs text-red-300 max-w-xs truncate">{log.errors || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
