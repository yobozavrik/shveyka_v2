'use client';

import MaterialSymbol from '@/components/MaterialSymbol';

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 px-1">
        <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
          Кількість упакованого <span className="text-primary">*</span>
        </label>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={quantityValue}
          onChange={(e) => onQuantityChange(e.target.value)}
          placeholder="0"
          className="h-14 w-full rounded-[20px] border-none bg-surface-container-low px-5 text-lg font-black text-on-surface outline-none transition-all placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
          Тип упаковки <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <select
            value={packagingType}
            onChange={(e) => onPackagingTypeChange(e.target.value)}
            className="h-14 w-full appearance-none rounded-[20px] border-none bg-surface-container-low px-5 text-sm font-black text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Оберіть тип упаковки</option>
            {PACKAGING_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">
            <MaterialSymbol name="unfold_more" tone="neutral" />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
          Примітки
        </label>
        <textarea
          rows={2}
          value={notesValue}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Додаткова інформація..."
          className="w-full resize-none rounded-[20px] border-none bg-surface-container-low p-5 text-sm font-bold text-on-surface outline-none transition-all placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/10"
        />
      </div>

      <button
        onClick={onSubmit}
        disabled={saving || !isReady}
        className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-primary text-sm font-black text-white shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
      >
        {saving ? (
          <MaterialSymbol name="sync" tone="primary" spin />
        ) : (
          <>
            <MaterialSymbol name="inventory_2" tone="primary" />
            Додати запис
          </>
        )}
      </button>
    </div>
  );
}
