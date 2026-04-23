'use client';

import { Loader2, Send } from 'lucide-react';

type QuantityFormProps = {
  operationName: string;
  operationCode: string;
  quantityValue: string;
  defectValue: string;
  notesValue: string;
  onQuantityChange: (value: string) => void;
  onDefectChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  saving: boolean;
  isReady: boolean;
};

export default function QuantityForm({
  operationName,
  quantityValue,
  defectValue,
  notesValue,
  onQuantityChange,
  onDefectChange,
  onNotesChange,
  onSubmit,
  saving,
  isReady,
}: QuantityFormProps) {
  return (
    <div className="space-y-4">
      {/* Quantity input */}
      <label className="space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
          <span>Кількість виконаного</span>
          <span className="text-red-500">*</span>
        </div>
        <input
          type="number"
          min="0"
          step="1"
          value={quantityValue}
          onChange={(e) => onQuantityChange(e.target.value)}
          placeholder="Введіть кількість"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500"
        />
      </label>

      {/* Defect input */}
      <label className="space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
          <span>Брак</span>
        </div>
        <input
          type="number"
          min="0"
          step="1"
          value={defectValue}
          onChange={(e) => onDefectChange(e.target.value)}
          placeholder="Кількість браку (якщо є)"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-semibold outline-none focus:border-red-500"
        />
      </label>

      {/* Notes input */}
      <label className="space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
          <span>Примітки</span>
        </div>
        <textarea
          rows={2}
          value={notesValue}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Додаткові примітки..."
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-semibold outline-none resize-none focus:border-blue-500"
        />
      </label>

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={saving || !isReady}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Додати запис
      </button>
    </div>
  );
}
