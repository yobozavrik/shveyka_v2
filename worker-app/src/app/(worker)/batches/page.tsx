'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, RefreshCw, Loader2, Package2, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { extractSelectedSizes } from '@/lib/sizeVariants';

interface Batch {
  id: number;
  batch_number: string;
  status: string;
  quantity: number;
  size_variants: Record<string, number> | null;
  is_urgent: boolean;
  priority: number;
  planned_end_date: string | null;
  product_models: { id: number; name: string; sku: string; category: string } | null;
  employees: { id: number; full_name: string } | null;
  fabric_type: string | null;
  fabric_color: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  created:   'Новий',
  cutting:   'Розкрій',
  sewing:    'Пошив',
  ready:     'Готово',
  shipped:   'Відвантажено',
  cancelled: 'Скасовано',
};

const STATUS_COLOR: Record<string, string> = {
  created:   'text-sky-400',
  cutting:   'text-orange-400',
  sewing:    'text-emerald-400',
  ready:     'text-green-400',
  shipped:   'text-teal-400',
  cancelled: 'text-red-400',
};

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mobile/batches?status=active&limit=50');
      if (!res.ok) throw new Error('Помилка завантаження');
      const data = await res.json();
      setBatches(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-4 py-6 safe-area-top">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-1)] tracking-tight">Партії</h2>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-3)] mt-1 ml-1">
            {batches.length} в роботі
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

      {/* Error */}
      {error && (
        <div className="glass border border-red-500/20 bg-red-500/10 rounded-[1.5rem] p-5 mb-6 flex items-center gap-3 text-red-500 text-sm animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && batches.length === 0 && (
        <div className="rounded-[2.5rem] border border-dashed border-[var(--border)] glass-muted px-8 py-20 text-center text-[var(--text-3)]">
          <Package2 className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-black text-[var(--text-1)]">Немає активних партій</p>
          <p className="mt-2 text-xs opacity-70">Зверніться до майстра для призначення</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {batches.map((batch) => (
          <button
            key={batch.id}
            onClick={() => router.push(`/batches/${batch.id}`)}
            className="w-full glass rounded-[2rem] p-5 text-left transition-all duration-300 active:scale-[0.98] border border-white/10 dark:border-white/5 shadow-xl shadow-black/5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Urgent badge + number */}
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  {batch.is_urgent && (
                    <span className="rounded-full bg-red-500/15 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-red-500 border border-red-500/20 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.2)]">
                      Терміново
                    </span>
                  )}
                  <span className="font-mono text-xs font-black text-emerald-500 bg-emerald-500/5 px-2.5 py-1 rounded-lg">
                    {batch.batch_number}
                  </span>
                </div>

                {/* Model name */}
                <p className="text-lg font-black text-[var(--text-1)] truncate tracking-tight mb-2">
                  {batch.product_models?.name || 'Невідома модель'}
                </p>

                {/* Details row */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-[var(--text-3)]">
                  <span className={clsx('rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10', STATUS_COLOR[batch.status] || 'text-[var(--text-2)]')}>
                    {STATUS_LABEL[batch.status] || batch.status}
                  </span>
                  <span className="opacity-30">•</span>
                  <span className="text-[var(--text-2)]">{batch.quantity} шт</span>
                  {batch.fabric_color && (
                    <>
                      <span className="opacity-30">•</span>
                      <span className="text-[var(--text-2)]">{batch.fabric_color}</span>
                    </>
                  )}
                </div>

                {batch.planned_end_date && (
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>До {new Date(batch.planned_end_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</span>
                  </div>
                )}

                {/* Size variants */}
                {(() => {
                  const sizes = extractSelectedSizes(batch.size_variants);
                  return sizes.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]/30">
                      {sizes.map((size) => (
                        <span key={size} className="rounded-lg glass-muted px-2.5 py-1 text-[10px] font-black text-[var(--text-2)] border border-[var(--border)]/50">
                          {size}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="mt-1 p-2 rounded-xl glass-muted text-[var(--text-3)]">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="h-24" />
    </div>
  );
}

