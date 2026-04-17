'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle, Tag, Plus, Minus } from 'lucide-react';

function EntryForm() {
  const router = useRouter();
  const sp = useSearchParams();

  const batchId = sp.get('batchId');
  const opId = sp.get('opId');
  const opName = sp.get('opName') || 'Операція';
  const preSize = sp.get('size') || '';
  const maxQty = parseInt(sp.get('maxQty') || '0') || 999;

  const [quantity, setQuantity] = useState(maxQty > 0 && maxQty < 999 ? maxQty : 1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const adjust = (delta: number) => {
    setQuantity((q) => Math.max(1, Math.min(maxQty, q + delta)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !opId) return;

    setLoading(true);
    setError('');

    const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch('/api/mobile/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: parseInt(batchId),
          operation_id: parseInt(opId),
          quantity,
          size: preSize || undefined,
          notes: notes || undefined,
          local_id: localId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Помилка збереження');
        return;
      }

      setSuccess(true);
    } catch {
      // Offline — queue for later
      try {
        const queue: any[] = JSON.parse(localStorage.getItem('mes_offline_queue') || '[]');
        queue.push({
          local_id: localId,
          batch_id: parseInt(batchId),
          operation_id: parseInt(opId),
          quantity,
          size: preSize || undefined,
          notes: notes || undefined,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem('mes_offline_queue', JSON.stringify(queue));
        setSuccess(true);
      } catch {
        setError('Помилка збереження офлайн');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-6">
        <div className="w-24 h-24 bg-green-500/20 border-2 border-green-500/40 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-green-400">ЗБЕРЕЖЕНО!</h2>
          <p className="text-[var(--text-2)] mt-2 text-sm">{opName}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-3xl font-black">{quantity}</span>
            <span className="text-[var(--text-2)]">шт</span>
            {preSize && (
              <span className="flex items-center gap-1 ml-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-bold">
                <Tag className="w-3.5 h-3.5" />
                {preSize}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => { setSuccess(false); setQuantity(1); setNotes(''); }}
            className="flex-1 bg-emerald-600 active:bg-emerald-700 py-4 rounded-2xl font-bold text-lg"
          >
            Ще раз
          </button>
          <button
            onClick={() => router.back()}
            className="flex-1 bg-[var(--bg-card2)] active:bg-black/10 dark:active:bg-white/10 py-4 rounded-2xl font-bold text-lg"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-5">
      {/* Header */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-[var(--text-2)] mb-6">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Операції</span>
      </button>

      <h2 className="text-xl font-black mb-1">{opName}</h2>

      {preSize && (
        <div className="flex items-center gap-2 mb-5">
          <Tag className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-300 font-bold text-lg">{preSize}</span>
        </div>
      )}

      {!preSize && <div className="mb-5" />}

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-4 mb-4 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-6">
        {/* Quantity picker */}
        <div>
          <label className="block text-xs font-black text-[var(--text-2)] uppercase tracking-wider mb-3">
            Кількість (макс. {maxQty})
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => adjust(-1)}
              className="w-16 h-16 bg-[var(--bg-card2)] active:bg-black/10 dark:active:bg-white/10 rounded-2xl flex items-center justify-center transition-colors"
            >
              <Minus className="w-7 h-7" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQty}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(maxQty, parseInt(e.target.value) || 1)))}
              className="flex-1 bg-[var(--bg-card)] border-2 border-[var(--border)] focus:border-emerald-500 rounded-2xl
                         text-center text-5xl font-black py-4 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => adjust(1)}
              className="w-16 h-16 bg-[var(--bg-card2)] active:bg-black/10 dark:active:bg-white/10 rounded-2xl flex items-center justify-center transition-colors"
            >
              <Plus className="w-7 h-7" />
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-black text-[var(--text-2)] uppercase tracking-wider mb-3">
            Примітка (необовʼязково)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Наприклад: брак тканини на 3 шт..."
            rows={3}
            className="w-full bg-[var(--bg-card)] border-2 border-[var(--border)] focus:border-emerald-500 rounded-2xl
                       px-4 py-3 text-sm outline-none transition-colors resize-none placeholder:text-slate-700"
          />
        </div>

        <div className="flex-1" />

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 active:bg-emerald-700 active:scale-[0.98] disabled:opacity-50
                     py-6 rounded-2xl text-2xl font-black flex items-center justify-center gap-3
                     shadow-2xl shadow-emerald-600/30 transition-all"
        >
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <>ЗБЕРЕГТИ РОБОТУ</>
          )}
        </button>
      </form>
    </div>
  );
}

export default function EntryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <EntryForm />
    </Suspense>
  );
}

