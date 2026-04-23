'use client';

import MaterialSymbol from '@/components/MaterialSymbol';

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 px-1">
        <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
          Кількість виконаного <span className="text-primary">*</span>
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

      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-1.5 px-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
            Брак
          </label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={defectValue}
            onChange={(e) => onDefectChange(e.target.value)}
            placeholder="0 (якщо є)"
            className="h-14 w-full rounded-[20px] border-none bg-surface-container-low px-5 text-lg font-black text-on-surface outline-none transition-all placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-red-500/10"
          />
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
            <MaterialSymbol name="send" tone="primary" />
            Додати запис
          </>
        )}
      </button>
    </div>
  );
}
