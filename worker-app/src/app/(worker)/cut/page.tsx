'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle, Save, Package } from 'lucide-react';
import { extractSelectedSizes } from '@/lib/sizeVariants';

interface BatchInfo {
  id: number;
  batch_number: string;
  quantity: number;
  size_variants: Record<string, number> | null;
  product_models: { name: string } | null;
}

function CuttingForm() {
  const router = useRouter();
  const sp = useSearchParams();

  const batchId = sp.get('batchId');
  const opId = sp.get('opId');
  const opName = sp.get('opName') || 'Розкрій';

  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    async function loadBatch() {
      if (!batchId) {
        setLoading(false);
        setError('ID партії не вказано');
        return;
      }
      try {
        const res = await fetch(`/api/mobile/batches/${batchId}`);
        if (!res.ok) throw new Error('Партія не знайдена');
        const data = await res.json();
        setBatch(data);
        
        // Use planned values OR default list from the photo
        const dict: Record<string, string> = {};
        
        const selectedSizes = extractSelectedSizes(data.size_variants);
        if (selectedSizes.length > 0) {
          selectedSizes.forEach((size) => {
            dict[size] = '';
          });
        } else if (data.size_variants && Object.keys(data.size_variants).length > 0) {
          Object.entries(data.size_variants).forEach(([size, qty]) => {
            if (size !== 'selected_sizes' && size !== 'sizes') {
              dict[size] = String(qty);
            }
          });
        } else {
          ['S', 'M', 'L', 'XL', '2XL'].forEach(s => { dict[s] = ''; });
        }
        setQuantities(dict);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadBatch();
  }, [batchId]);

  const updateQty = (size: string, val: string) => {
    setQuantities(prev => ({ ...prev, [size]: val }));
  };

  const total = Object.values(quantities).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  const [submitMode, setSubmitMode] = useState<'submitted' | 'approved'>('submitted');

  const handleSubmit = async (e: React.FormEvent, mode: 'submitted' | 'approved' = 'submitted') => {
    e?.preventDefault();
    if (!batchId || !opId) return;

    setSubmitMode(mode);
    setSubmitting(true);
    setError('');

    const entries = Object.entries(quantities)
      .filter(([_, qty]) => (parseInt(qty) || 0) > 0)
      .map(([size, qty]) => ({
        batch_id: parseInt(batchId),
        operation_id: parseInt(opId),
        quantity: parseInt(qty),
        size,
        status: mode,
        local_id: `${Date.now()}-${size}-${Math.random().toString(36).slice(2)}`
      }));

    if (entries.length === 0) {
      setError('Введіть кількість хоча б для одного розміру');
      setSubmitting(false);
      return;
    }

    try {
      // 1. Submit entries for each size
      for (const entry of entries) {
        const res = await fetch('/api/mobile/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Помилка збереження розміру ${entry.size}`);
        }
      }

      // 2. Update the batch itself (set actual sizes and total quantity)
      const sizeVariantsNum: Record<string, number> = {};
      Object.entries(quantities).forEach(([s, q]) => {
        const n = parseInt(q);
        if (n > 0) sizeVariantsNum[s] = n;
      });

      const resBatch = await fetch(`/api/mobile/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size_variants: sizeVariantsNum,
          quantity: total,
          status: 'cutting'
        }),
      });

      if (!resBatch.ok) {
        throw new Error('Помилка оновлення даних партії');
      }

      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-6">
        <div className="w-24 h-24 bg-green-500/20 border-2 border-green-500/40 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-green-400">РОЗКРІЙ ЗБЕРЕЖЕНО!</h2>
          <p className="text-[var(--text-2)] mt-2 text-sm">{batch?.product_models?.name}</p>
          <div className="mt-4 inline-block bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <div className="text-3xl font-black">{total} <span className="text-sm font-normal text-[var(--text-2)]">шт всього</span></div>
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {Object.entries(quantities).map(([s, q]) => (
                <span key={s} className="bg-[var(--bg-card2)] px-2 py-1 rounded-lg text-xs font-bold">
                  {s}: {q}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => router.back()}
          className="w-full max-w-sm bg-emerald-600 active:bg-emerald-700 py-5 rounded-2xl font-black text-xl"
        >
          ПОВЕРНУТИСЬ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-5 pb-10">
      {/* Header */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-[var(--text-2)] mb-6">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Операції</span>
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300 font-mono">{batch?.batch_number}</span>
        </div>
        <h2 className="text-2xl font-black leading-tight">{batch?.product_models?.name}</h2>
        <p className="text-[var(--text-2)] text-sm mt-1">Введіть фактичну кількість після розкрою</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-4 mb-6 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] border-b border-[var(--border)]">
            <div className="p-4 bg-[var(--bg-card2)] text-[var(--text-3)] text-[10px] font-black uppercase tracking-widest">Розмір</div>
            <div className="p-4 bg-[var(--bg-card2)] text-[var(--text-3)] text-[10px] font-black uppercase tracking-widest">Кількість</div>
          </div>
          
          {Object.keys(quantities).sort((a, b) => {
            const order = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
            const idxA = order.indexOf(a.toUpperCase());
            const idxB = order.indexOf(b.toUpperCase());
            if (idxA === -1 && idxB === -1) return a.localeCompare(b);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          }).map((size) => (
            <div key={size} className="grid grid-cols-2 divide-x divide-[var(--border)] border-b last:border-0 border-[var(--border)] items-center">
              <div className="px-6 py-4 text-xl font-black">{size}</div>
              <div className="p-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={quantities[size] || ''}
                  onChange={(e) => updateQty(size, e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent border-none text-right text-2xl font-black py-3 outline-none placeholder:text-white/10"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add Size Control */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Новий розмір (напр. XS)"
            className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-colors"
            id="new-size-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                if (val && !quantities[val]) {
                  setQuantities(prev => ({ ...prev, [val]: '' }));
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('new-size-input') as HTMLInputElement;
              const val = el.value.trim().toUpperCase();
              if (val && !quantities[val]) {
                setQuantities(prev => ({ ...prev, [val]: '' }));
                el.value = '';
              }
            }}
            className="bg-[var(--bg-card)] border border-[var(--border)] px-4 rounded-2xl font-bold text-xs uppercase"
          >
            Додати
          </button>
        </div>

        {/* Total Summary */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-300 uppercase">Всього:</span>
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{total} шт</span>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any, 'submitted')}
            disabled={submitting}
            className="flex-1 bg-slate-800 dark:bg-slate-800 active:bg-slate-900 border border-slate-700 py-6 rounded-2xl text-lg font-black flex items-center justify-center gap-2 transition-all text-white"
          >
            {submitting && submitMode === 'submitted' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                ЗБЕРЕГТИ
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={submitting}
            className="flex-1 bg-emerald-600 active:bg-emerald-700 shadow-xl shadow-emerald-900/20 py-6 rounded-2xl text-lg font-black flex items-center justify-center gap-2 border-b-4 border-emerald-800 transition-all active:border-b-0 active:translate-y-1 text-white"
          >
            {submitting && submitMode === 'approved' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" />
                ПІДТВЕРДИТИ
              </>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black text-center mb-2 text-slate-900 dark:text-white">Ви впевнені?</h3>
            <p className="text-slate-500 dark:text-[var(--text-2)] text-center text-sm mb-8 leading-relaxed">
              Це остаточне підтвердження розкрою. Після цього дані буде зафіксовано, і партія перейде на наступний етап.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={(e) => {
                  setShowConfirmModal(false);
                  handleSubmit(e as any, 'approved');
                }}
                className="w-full bg-emerald-600 py-4 rounded-2xl font-black text-lg active:bg-emerald-700 transition-colors text-white"
              >
                ТАК, ПІДТВЕРДИТИ
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full bg-transparent py-4 rounded-2xl font-bold text-slate-400 dark:text-slate-400 active:text-slate-900 dark:active:text-white transition-colors"
              >
                ВІДМІНА
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <CuttingForm />
    </Suspense>
  );
}
