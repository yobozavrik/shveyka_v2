'use client';

import { Loader2, Send } from 'lucide-react';

type PackagingTypeOption = {
  label: string;
  value: string;
};

const PACKAGING_TYPES: PackagingTypeOption[] = [
  { label: 'Індивідуальна упаковка', value: 'individual' },
  { label: 'Групова упаковка', value: 'group' },
  { label: 'Пакет', value: 'bag' },
  { label: 'Коробка', value: 'box' },
];

type PackagingFormProps = {
  quantityValue: string;
  packagingType: string;
  notesValue: string;
  onQuantityChange: (value: string) => void;
  onPackagingTypeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  saving: boolean;
  isReady: boolean;
};

export default function PackagingForm({
  quantityValue,
  packagingType,
  notesValue,
  onQuantityChange,
  onPackagingTypeChange,
  onNotesChange,
  onSubmit,
  saving,
  isReady,
}: PackagingFormProps) {
  return (
    <div className="space-y-4">
      {/* Quantity input */}
      <label className="space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
          <span>Кількість упакованого</span>
          <span className="text-red-500">*</span>
        </div>
        <input
          type="number"
          min="0"
          step="1"
          value={quantityValue}
          onChange={(e) => onQuantityChange(e.target.value)}
          placeholder="Введіть кількість"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500"
        />
      </label>

      {/* Packaging type select */}
      <label className="space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
          <span>Тип упаковки</span>
        </div>
        <select
          value={packagingType}
          onChange={(e) => onPackagingTypeChange(e.target.value)}
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none focus:border-orange-500"
        >
          <option value="">Оберіть тип упаковки</option>
          {PACKAGING_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-semibold outline-none resize-none focus:border-orange-500"
        />
      </label>

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={saving || !isReady}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Додати запис
      </button>
    </div>
  );
}
