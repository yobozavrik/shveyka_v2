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
    <div className="px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black">Активні партії</h2>
          <p className="text-[var(--text-2)] text-xs mt-0.5">{batches.length} партій в роботі</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2.5 bg-[var(--bg-card2)] rounded-xl active:bg-black/10 dark:active:bg-white/10 transition-colors"
        >
          <RefreshCw className={clsx('w-5 h-5 text-[var(--text-2)]', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3 text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && batches.length === 0 && (
        <div className="text-center py-16 text-[var(--text-3)]">
          <Package2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Немає активних партій</p>
          <p className="text-xs mt-1">Зверніться до майстра</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {batches.map((batch) => (
          <button
            key={batch.id}
            onClick={() => router.push(`/batches/${batch.id}`)}
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] active:border-emerald-500/50 active:bg-[var(--bg-card2)]
                       rounded-2xl p-4 text-left transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Urgent badge + number */}
                <div className="flex items-center gap-2 mb-1">
                  {batch.is_urgent && (
                    <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3" /> Терміново
                    </span>
                  )}
                  <span className="text-xs font-bold text-emerald-300 font-mono">{batch.batch_number}</span>
                </div>

                {/* Model name */}
                <p className="font-bold text-base text-[var(--text-1)] truncate">
                  {batch.product_models?.name || 'Невідома модель'}
                </p>

                {/* Details row */}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-2)]">
                  <span className={clsx('font-semibold', STATUS_COLOR[batch.status] || 'text-[var(--text-2)]')}>
                    {STATUS_LABEL[batch.status] || batch.status}
                  </span>
                  <span>·</span>
                  <span>{batch.quantity} шт</span>
                  {batch.fabric_color && (
                    <>
                      <span>·</span>
                      <span>{batch.fabric_color}</span>
                    </>
                  )}
                  {batch.planned_end_date && (
                    <>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      <span>{new Date(batch.planned_end_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</span>
                    </>
                  )}
                </div>

                {/* Size variants */}
                {(() => {
                  const sizes = extractSelectedSizes(batch.size_variants);
                  return sizes.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sizes.map((size) => (
                        <span key={size} className="bg-[var(--bg-card2)] text-[var(--text-1)] text-xs px-2 py-0.5 rounded-full font-bold">
                          {size}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>

              <ChevronRight className="w-5 h-5 text-[var(--text-3)] shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

