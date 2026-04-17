'use client';

import { useState, useEffect } from 'react';
import { ClipboardCheck, Check, X, Loader2, Clock, Package, User, Wrench, RefreshCw } from 'lucide-react';

interface Entry {
  id: number;
  quantity: number; // Теперь здесь уже ПОЛНАЯ сумма (например, 105)
  size: string | null;
  data: Record<string, any> | null;
  status: string;
  notes: string | null;
  created_at: string;
  employees: { id: number; full_name: string; position: string } | null;
  operations: { id: number; name: string; code: string; base_rate: number } | null;
  production_batches: { id: number; batch_number: string; product_models: { name: string } | null } | null;
}

export default function MasterPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/entries?status=submitted&limit=100');
      const data = await res.json();
      const entriesData = Array.isArray(data) ? data : [];
      
      // ОТЛАДКА: Выведем первую запись в консоль, чтобы посмотреть структуру
      if (entriesData.length > 0) {
        console.log('DEBUG Master Entry:', JSON.stringify(entriesData[0], null, 2));
      }
      
      setEntries(entriesData);
    } finally { setLoading(false); }
  }

  async function handleAction(id: number, action: 'confirm' | 'reject', rejectComment?: string) {
    setProcessing(id);
    try {
      const res = await fetch('/api/entries/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: id, action, comment: rejectComment || null }),
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
        setRejectId(null);
        setComment('');
      }
    } finally { setProcessing(null); }
  }

  const handleRejectSubmit = () => {
    if (rejectId) handleAction(rejectId, 'reject', comment);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <ClipboardCheck className="h-7 w-7 text-indigo-500" />
            Підтвердження виробітку
          </h1>
          <p className="text-[var(--text-2)] text-sm mt-1">Перевірка та затвердження записів швачок</p>
        </div>
        <div className="flex items-center gap-3">
          {entries.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl text-sm font-bold">
              <Clock className="h-4 w-4" />
              {entries.length} очікує
            </div>
          )}
          <button onClick={load} className="p-2 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl text-[var(--text-2)]">
          <Check className="h-12 w-12 mx-auto mb-3 text-green-500/40" />
          <p className="font-semibold">Нових записів для перевірки немає</p>
          <p className="text-sm mt-1">Всі записи підтверджено</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--text-2)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Час</th>
                <th className="px-4 py-3 text-left font-semibold">Швачка</th>
                <th className="px-4 py-3 text-left font-semibold">Партія / Операція</th>
                <th className="px-4 py-3 text-right font-semibold">К-сть / Розмір</th>
                <th className="px-4 py-3 text-right font-semibold">Сума, грн</th>
                <th className="px-4 py-3 text-center font-semibold">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-4 py-3 text-[var(--text-2)] text-xs font-mono">
                    {new Date(e.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    <div>{new Date(e.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-[var(--text-2)]" />
                      <span className="font-medium">{e.employees?.full_name || '—'}</span>
                    </div>
                    <div className="text-xs text-[var(--text-2)] mt-0.5">{e.employees?.position}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3 w-3 text-indigo-400" />
                      <span className="font-mono text-indigo-300 font-bold">{e.production_batches?.batch_number || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Wrench className="h-3 w-3 text-[var(--text-2)]" />
                      <span className="text-xs text-[var(--text-2)]">{e.operations?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-black text-lg text-[var(--text-1)]">
                      {e.quantity}
                    </div>
                    {/* Показываем разбивку по размерам, если она есть (для инфо) */}
                    {e.data?.size_breakdown && (
                      <div className="text-[10px] text-[var(--text-2)] font-mono mt-0.5 truncate max-w-[120px] ml-auto">
                        {Object.entries(e.data.size_breakdown).map(([size, qty]) => `${size}:${qty}`).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-400">
                    {/* Сумма теперь считается от ПОЛНОГО quantity */}
                    {(e.quantity * (e.operations?.base_rate || 0)).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        disabled={processing === e.id}
                        onClick={() => { setRejectId(e.id); setComment(''); }}
                        className="p-2 text-[var(--text-2)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Відхилити"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button
                        disabled={processing === e.id}
                        onClick={() => handleAction(e.id, 'confirm')}
                        className="p-2 bg-green-600 hover:bg-green-500 text-[var(--text-1)] rounded-xl transition-colors flex items-center justify-center w-9 h-9"
                        title="Підтвердити"
                      >
                        {processing === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-red-400">Відхилити запис?</h3>
            <div>
              <label className="text-xs text-[var(--text-2)] mb-1 block font-semibold uppercase">Причина (необовʼязково)</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-500 resize-none"
                placeholder="Вкажіть причину відхилення..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)}
                className="flex-1 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Скасувати
              </button>
              <button onClick={handleRejectSubmit} disabled={processing !== null}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                {processing !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                Відхилити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
