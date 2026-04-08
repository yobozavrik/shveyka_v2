'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle, Save, Tag } from 'lucide-react';
import { usePipelineData, SizeValues } from '@/hooks/usePipelineData';

function MatrixForm() {
  const router = useRouter();
  const sp = useSearchParams();

  const batchId = sp.get('batchId');
  const opId = sp.get('opId');
  const opName = sp.get('opName') || 'Операція';
  const isEmbroidery = opName.toLowerCase().includes('вишивк');

  const { 
    batch, 
    loading, 
    error: hookError, 
    incomingSizes, 
    initialQuantities 
  } = usePipelineData(batchId, opId);

  const [vals, setVals] = useState<Record<string, SizeValues>>({});
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitMode, setSubmitMode] = useState<'submitted' | 'approved'>('submitted');

  // Initialize values from hook's initial quantities ONLY ONCE
  useEffect(() => {
    if (!initialized && Object.keys(initialQuantities).length > 0) {
      setVals(initialQuantities);
      setInitialized(true);
    }
  }, [initialQuantities, initialized]);

  const updateVal = (size: string, field: keyof SizeValues, val: string) => {
    setVals(prev => ({
      ...prev,
      [size]: { ...prev[size], [field]: val }
    }));
  };

  const totalQty = Object.values(vals).reduce((sum, v) => sum + (parseInt(v.qty) || 0), 0);
  const totalDefect = Object.values(vals).reduce((sum, v) => sum + (parseInt(v.defect) || 0), 0);
  const totalMetric = Object.values(vals).reduce((sum, v) => sum + (parseFloat(v.metric) || 0), 0);

  const addSize = (size: string) => {
    const s = size.trim().toUpperCase();
    if (s && !vals[s]) {
      setVals(prev => ({
        ...prev,
        [s]: { qty: '', defect: '', metric: '', local_id: '' }
      }));
    }
  };

  // Check per-size limit: qty + defect must not exceed incoming
  const sizeErrors = Object.fromEntries(
    Object.entries(vals).map(([size, v]) => {
      const incoming = incomingSizes[size];
      if (incoming === undefined) return [size, false];
      return [size, (parseInt(v.qty) || 0) + (parseInt(v.defect) || 0) > incoming];
    })
  );
  const hasAnyOverLimit = Object.values(sizeErrors).some(Boolean);

  const handleSubmit = async (e: React.FormEvent, mode: 'submitted' | 'approved' = 'submitted') => {
    e?.preventDefault();
    if (!batchId || !opId) return;

    // Frontend limit validation — catch overages before hitting the server
    const limitErrors: string[] = [];
    for (const [size, v] of Object.entries(vals)) {
      const incoming = incomingSizes[size];
      if (incoming === undefined) continue; // no limit known
      const qty = parseInt(v.qty) || 0;
      const defect = parseInt(v.defect) || 0;
      if (qty + defect > incoming) {
        limitErrors.push(`${size}: ${qty + defect} шт > ${incoming} шт (ліміт)`);
      }
    }
    if (limitErrors.length > 0) {
      setError(`Перевищено ліміт:\n${limitErrors.join('\n')}`);
      return;
    }

    setSubmitMode(mode);
    setSubmitting(true);
    setError('');

    const entries = Object.entries(vals)
      .filter(([_, v]) => (parseInt(v.qty) || 0) > 0 || (parseInt(v.defect) || 0) > 0)
      .map(([size, v]) => ({
        batch_id: parseInt(batchId),
        operation_id: parseInt(opId),
        quantity: parseInt(v.qty) || 0,
        defect_quantity: parseInt(v.defect) || 0,
        metric_value: parseFloat(v.metric) || 0,
        size,
        status: mode,
        // Reuse local_id for updates, OR create new one for new entries
        local_id: v.local_id || `${Date.now()}-${size}-${Math.random().toString(36).slice(2)}`
      }));

    if (entries.length === 0) {
      setError('Введіть придатну кількість або брак хоча б для одного розміру');
      setSubmitting(false);
      return;
    }

    try {
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
          <h2 className="text-2xl font-black text-green-400">
            Дані успішно {submitMode === 'approved' ? 'підтверджені' : 'збережені'}.
          </h2>
          <p className="text-[var(--text-2)] mt-2 text-sm">{opName}</p>
          <div className="mt-4 inline-block bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <div className="text-3xl font-black">{totalQty} <span className="text-sm font-normal text-[var(--text-2)]">шт годних</span></div>
            {totalDefect > 0 && <div className="text-lg font-bold text-red-400">+{totalDefect} шт брак</div>}
          </div>
        </div>
        <button
          onClick={() => router.back()}
          className="w-full max-w-sm bg-emerald-600 active:bg-emerald-700 py-5 rounded-2xl font-black text-xl text-white outline-none active:scale-95 transition-all"
        >
          ПОВЕРНУТИСЬ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-3 py-5 pb-10">
      {/* Header */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-[var(--text-2)] mb-6">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Операції</span>
      </button>

      <div className="mb-6 px-1">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300 font-mono">{batch?.batch_number}</span>
        </div>
        <h2 className="text-2xl font-black leading-tight truncate">{opName}</h2>
        <p className="text-[var(--text-2)] text-xs mt-1 truncate">{batch?.product_models?.name}</p>
      </div>

      {(error || hookError) && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-4 mb-6 text-sm font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || hookError}</span>
        </div>
      )}

      <form className="flex flex-col flex-1 gap-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className={`grid ${isEmbroidery ? 'grid-cols-[1fr_1.2fr_1fr_1.2fr]' : 'grid-cols-[1.5fr_1.2fr_1fr]'} divide-x divide-[var(--border)] bg-[var(--bg-card2)] border-b border-[var(--border)]`}>
            <div className="p-3 text-[9px] font-black uppercase tracking-wider text-[var(--text-3)] text-center">Розмір</div>
            <div className="p-3 text-[9px] font-black uppercase tracking-wider text-green-400 text-center">Придатно</div>
            <div className="p-3 text-[9px] font-black uppercase tracking-wider text-red-400 text-center">Брак</div>
            {isEmbroidery && <div className="p-3 text-[9px] font-black uppercase tracking-wider text-blue-400 text-center">Стежки</div>}
          </div>
          
          {Object.keys(vals).sort((a, b) => {
            const order = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
            const idxA = order.indexOf(a.toUpperCase());
            const idxB = order.indexOf(b.toUpperCase());
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
          }).map((size) => {
            const isOverLimit = sizeErrors[size] === true;
            return (
            <div key={size} className={`grid ${isEmbroidery ? 'grid-cols-[1fr_1.2fr_1fr_1.2fr]' : 'grid-cols-[1.5fr_1.2fr_1fr]'} divide-x divide-[var(--border)] border-b last:border-0 border-[var(--border)] items-center ${isOverLimit ? 'bg-red-500/10' : ''}`}>
              {/* Size Info */}
              <div className="px-4 py-3 flex flex-col justify-center min-w-0 text-center">
                <span className="text-xl font-black font-mono">{size}</span>
                {incomingSizes[size] !== undefined && (
                  <span className={`text-[9px] font-bold truncate tracking-tighter ${isOverLimit ? 'text-red-400 font-black' : 'text-[var(--text-3)]'}`}>
                    {isOverLimit ? '⚠ ' : ''}Дост: {incomingSizes[size]}
                  </span>
                )}
              </div>
              
              {/* Quantity Input */}
              <div className="p-0.5">
                <input
                  type="number"
                  inputMode="numeric"
                  value={vals[size]?.qty || ''}
                  onChange={(e) => updateVal(size, 'qty', e.target.value)}
                  placeholder="0"
                  className={`w-full bg-transparent border-none text-center text-2xl font-black py-4 outline-none placeholder:text-white/5 ${isOverLimit ? 'text-red-400' : 'text-emerald-400'}`}
                />
              </div>

              {/* Defect Input */}
              <div className={`p-0.5 ${isOverLimit ? 'bg-red-500/20' : 'bg-red-500/5'}`}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={vals[size]?.defect === '0' ? '' : vals[size]?.defect}
                  onChange={(e) => updateVal(size, 'defect', e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent border-none text-center text-xl font-black py-4 outline-none placeholder:text-white/5 text-red-400"
                />
              </div>

              {/* Metric Input (Embroidery only) */}
              {isEmbroidery && (
                <div className="p-0.5 bg-blue-500/5">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={vals[size]?.metric === '0' ? '' : vals[size]?.metric}
                    onChange={(e) => updateVal(size, 'metric', e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent border-none text-center text-lg font-black py-4 outline-none placeholder:text-white/5 text-blue-400"
                  />
                </div>
              )}
            </div>
            );
          })}
        </div>

        {/* Add Size Control */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Новий розмір (напр. XXL)"
            id="new-size-input"
            className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-4 text-sm outline-none focus:border-emerald-500 transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSize((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById('new-size-input') as HTMLInputElement;
              addSize(input.value);
              input.value = '';
            }}
            className="bg-[var(--bg-card2)] border border-[var(--border)] px-6 rounded-2xl font-black text-xs uppercase text-emerald-400 active:scale-95 transition-all"
          >
            Додати
          </button>
        </div>

        {/* Totals Section */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-2">
           <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-[var(--text-3)] uppercase tracking-widest">Всього придатних:</span>
            <span className="text-2xl font-black text-emerald-400">{totalQty} шт</span>
          </div>
          {totalDefect > 0 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
              <span className="text-[10px] font-black text-[var(--text-3)] uppercase tracking-widest text-red-500/60">Загальний брак:</span>
              <span className="text-2xl font-black text-red-500">{totalDefect} шт</span>
            </div>
          )}
          {isEmbroidery && (
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
              <span className="text-[10px] font-black text-[var(--text-3)] uppercase tracking-widest text-blue-400/60">Всього стежків:</span>
              <span className="text-2xl font-black text-blue-400 font-mono">{totalMetric.toFixed(2)} тис.</span>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any, 'submitted')}
            disabled={submitting}
            className="flex-1 bg-slate-800 active:bg-slate-900 border border-slate-700 py-6 rounded-2xl text-lg font-black flex items-center justify-center gap-2 transition-all text-white outline-none active:scale-95"
          >
            {submitting && submitMode === 'submitted' ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5 text-slate-400" />
                ЗБЕРЕГТИ
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setSubmitMode('approved'); setShowConfirmModal(true); }}
            disabled={submitting}
            className="flex-1 bg-emerald-600 active:bg-emerald-700 shadow-xl shadow-emerald-900/10 py-6 rounded-2xl text-lg font-black flex items-center justify-center gap-2 border-b-4 border-emerald-800 transition-all active:border-b-0 active:translate-y-1 text-white outline-none"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-2xl font-black text-center mb-2">Остаточне підтвердження</h3>
            <p className="text-[var(--text-2)] text-center text-sm mb-8 leading-relaxed">
              Ви впевнені? Після підтвердження дані щодо <b>{totalQty} шт</b> будуть зафіксовані та **передані на наступну операцію**. Редагування буде закрито.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={(e) => { setShowConfirmModal(false); handleSubmit(e as any, 'approved'); }}
                className="w-full bg-emerald-600 py-4 rounded-2xl font-black text-lg active:bg-emerald-700 transition-colors text-white outline-none shadow-lg shadow-emerald-900/20"
              >
                ТАК, ПІДТВЕРДИТИ
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full bg-transparent py-4 rounded-2xl font-bold text-slate-400 transition-colors"
              >
                ПЕРЕВІРИТИ ЩЕ РАЗ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatrixPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-indigo-500 font-bold font-mono">ЗАВАНТАЖЕННЯ...</div>}>
      <MatrixForm />
    </Suspense>
  );
}
