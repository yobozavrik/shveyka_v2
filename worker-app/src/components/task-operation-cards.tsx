'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { getStageConfig } from '@/lib/stageConfig';
import EntryHistory from '@/components/EntryHistory';
import QuantityForm from '@/components/QuantityForm';
import PackagingForm from '@/components/PackagingForm';
import MaterialSymbol from '@/components/MaterialSymbol';
import {
  type FieldSchema,
  type Entry,
  FieldInput,
  NastilEntryCard,
  EmbroideryQueueCard,
} from '@/components/task-page-shared';

type StageOp = {
  id: number;
  stage_id: number;
  code: string;
  name: string;
  field_schema: FieldSchema[];
  sort_order: number;
  is_active: boolean;
};

function isDraftReady(fields: FieldSchema[], draft: Record<string, any>) {
  return fields.every((field) => {
    if (!field.required) return true;
    if (field.type === 'boolean') return true;
    return String(draft[field.key] ?? '').trim() !== '';
  });
}

export function OperationCard({
  operation,
  entries,
  draft,
  setDraft,
  onSubmit,
  availableColors,
  selectedSizes,
  legacySizes,
  saving,
}: {
  operation: StageOp;
  entries: Entry[];
  draft: Record<string, any>;
  setDraft: (next: Record<string, any>) => void;
  onSubmit: () => void;
  availableColors: Array<{ color: string; rolls: number }>;
  selectedSizes: string[];
  legacySizes: Array<[string, number]>;
  saving: boolean;
}) {
  const fields = Array.isArray(operation.field_schema) ? operation.field_schema : [];
  const ready = isDraftReady(fields, draft);

  return (
    <section className="space-y-5 rounded-[2.5rem] bg-white p-6 dark:bg-surface-container-lowest">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-500">
          <MaterialSymbol name="edit_note" tone="emerald" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black text-[var(--text-1)]">{operation.name}</div>
          <div className="text-xs text-[var(--text-3)]">
            {operation.code} · {fields.length} полів
          </div>
        </div>
      </div>

      {operation.code === 'nastil' && (
        <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Розмірна сітка</div>
              <div className="text-sm font-black text-[var(--text-1)]">По партії</div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              {selectedSizes.length > 0
                ? `${selectedSizes.length} вибрано`
                : legacySizes.length > 0
                  ? 'Старий формат'
                  : '—'}
            </div>
          </div>

          {selectedSizes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedSizes.map((size) => (
                <span
                  key={size}
                  className="inline-flex items-center rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-black text-slate-800 shadow-sm"
                >
                  {size}
                </span>
              ))}
            </div>
          ) : legacySizes.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {legacySizes
                .slice()
                .sort((left, right) => left[0].localeCompare(right[0], 'uk'))
                .map(([size, qty]) => (
                  <div
                    key={size}
                    className="flex items-center justify-between rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-bold text-[var(--text-2)]"
                  >
                    <span>{size}</span>
                    <span>{qty}</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--text-3)]">Розмірна сітка не задана.</div>
          )}
        </div>
      )}

      {fields.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {fields.map((field) => (
            <label key={field.key} className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
                <span>{field.label}</span>
                {field.required && <span className="text-red-500">*</span>}
              </div>
              <FieldInput
                field={field}
                value={draft[field.key]}
                availableColors={availableColors}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    [field.key]: value,
                  })
                }
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border-2 border-dashed border-[var(--border)] bg-[var(--bg-base)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
          Для цієї операції ще не задано схему полів
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={saving || !ready}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-60"
      >
        {saving ? <MaterialSymbol name="sync" tone="emerald" spin /> : <MaterialSymbol name="add_task" tone="emerald" />}
        Додати запис
      </button>

      {entries.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
            Внесені записи: {entries.length}
          </div>
          <div className="space-y-3">
            {entries.map((entry, index) =>
              operation.code === 'nastil' ? (
                <NastilEntryCard key={String(entry.id)} entry={entry} index={index} selectedSizes={selectedSizes} />
              ) : (
                <div
                  key={String(entry.id)}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-bold text-[var(--text-1)]">
                      #{index + 1} · {entry.operation_name || operation.name}
                    </div>
                    <div className="text-xs font-black text-emerald-500">
                      {Number(entry.quantity || 0)} шт
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-[var(--text-3)]">
                    {entry.data &&
                      typeof entry.data === 'object' &&
                      Object.entries(entry.data)
                        .filter(([key]) => key !== 'notes')
                        .slice(0, 6)
                        .map(([key, val]) => (
                          <span key={key}>
                            {key}: {String(val)}
                          </span>
                        ))}
                  </div>
                  {entry.notes && <div className="mt-2 text-xs text-[var(--text-2)]">{entry.notes}</div>}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function CuttingOperationCard({
  operation,
  entries,
  draft,
  setDraft,
  onSubmit,
  availableColors,
  selectedSizes,
  legacySizes,
  saving,
}: {
  operation: StageOp;
  entries: Entry[];
  draft: Record<string, any>;
  setDraft: (next: Record<string, any>) => void;
  onSubmit: () => void;
  availableColors: Array<{ color: string; rolls: number }>;
  selectedSizes: string[];
  legacySizes: Array<[string, number]>;
  saving: boolean;
}) {
  const fields = Array.isArray(operation.field_schema) ? operation.field_schema : [];
  const ready = isDraftReady(fields, draft);

  return (
    <section className="space-y-6 rounded-[32px] border border-outline-variant/10 bg-white p-6 shadow-sm dark:bg-surface-container-lowest">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MaterialSymbol name="content_cut" tone="primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-tight text-on-surface">{operation.name}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {operation.code} · {fields.length} полів
          </p>
        </div>
      </div>

      {operation.code === 'nastil' && (
        <div className="space-y-4 rounded-[24px] border border-outline-variant/5 bg-surface-container-low/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">
              Розмірна сітка партії
            </span>
            <span className="text-[10px] font-bold uppercase text-on-surface-variant/40">
              {selectedSizes.length || legacySizes.length} типів
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedSizes.length > 0 ? (
              selectedSizes.map((size) => (
                <span
                  key={size}
                  className="rounded-xl border border-outline-variant/10 bg-white px-4 py-2 text-xs font-black text-on-surface shadow-sm dark:bg-surface-container-lowest"
                >
                  {size}
                </span>
              ))
            ) : legacySizes.length > 0 ? (
              legacySizes.map(([size, qty]) => (
                <div
                  key={size}
                  className="flex items-center gap-2 rounded-xl border border-outline-variant/10 bg-white px-3 py-2 text-xs font-black text-on-surface shadow-sm dark:bg-surface-container-lowest"
                >
                  {size} <span className="text-[10px] opacity-30">·</span> {qty}
                </div>
              ))
            ) : (
              <span className="text-xs font-medium italic text-on-surface-variant/40">Сітка не вказана</span>
            )}
          </div>
        </div>
      )}

      {fields.length > 0 ? (
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
                  {field.label}
                </span>
                {field.required && <span className="text-primary">*</span>}
              </div>
              <FieldInput
                field={field}
                value={draft[field.key]}
                availableColors={availableColors}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    [field.key]: value,
                  })
                }
              />
              {operation.code === 'nastil' && field.key === 'quantity_per_nastil' && (
                <p className="px-1 text-[9px] font-medium italic text-on-surface-variant/40">
                  Кількість буде застосована до кожного вибраного розміру
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border-2 border-dashed border-outline-variant/10 py-8 text-center">
          <span className="text-sm font-medium italic text-on-surface-variant/40">Схема полів відсутня</span>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={saving || !ready}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-primary text-sm font-black text-white shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
      >
        {saving ? <MaterialSymbol name="sync" tone="primary" spin filled /> : <MaterialSymbol name="add_circle" tone="primary" />}
        Додати запис
      </button>

      {entries.length > 0 && (
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">
              Історія настилів
            </span>
            <span className="text-[10px] font-black uppercase text-primary">{entries.length} записів</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {entries.map((entry, index) => (
              <NastilEntryCard key={String(entry.id)} entry={entry} index={index} selectedSizes={selectedSizes} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function SimpleQuantityOperationCard({
  operation,
  entries,
  stageCode,
  saving,
  onSubmit,
}: {
  operation: StageOp;
  entries: Entry[];
  stageCode: string | null;
  saving: boolean;
  onSubmit: (quantity: string, defect: string, notes: string) => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [defect, setDefect] = useState('');
  const [notes, setNotes] = useState('');

  const isReady = quantity.trim() !== '' && Number(quantity) > 0;
  const stageConfig = getStageConfig(stageCode);

  const handleSubmit = () => {
    onSubmit(quantity, defect, notes);
    setQuantity('');
    setDefect('');
    setNotes('');
  };

  return (
    <section className="space-y-5 rounded-[32px] border border-outline-variant/10 bg-white p-6 shadow-sm dark:bg-surface-container-lowest">
      <div className="flex items-center gap-4">
        <div className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl', stageConfig.bgAccent, stageConfig.textAccent)}>
          <MaterialSymbol name="edit_square" tone="primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-tight text-on-surface">{operation.name}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {stageConfig.labelUk} · Ввід кількості
          </p>
        </div>
      </div>

      <QuantityForm
        operationName={operation.name}
        operationCode={operation.code}
        quantityValue={quantity}
        defectValue={defect}
        notesValue={notes}
        onQuantityChange={setQuantity}
        onDefectChange={setDefect}
        onNotesChange={setNotes}
        onSubmit={handleSubmit}
        saving={saving}
        isReady={isReady}
      />

      {entries.length > 0 && (
        <div className="pt-2">
          <EntryHistory entries={entries} stageCode={stageCode} emptyMessage="Ще немає записів" />
        </div>
      )}
    </section>
  );
}

export function PackagingOperationCard({
  operation,
  entries,
  stageCode,
  saving,
  onSubmit,
}: {
  operation: StageOp;
  entries: Entry[];
  stageCode: string | null;
  saving: boolean;
  onSubmit: (quantity: string, packagingType: string, notes: string) => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [notes, setNotes] = useState('');

  const isReady = quantity.trim() !== '' && Number(quantity) > 0 && packagingType.trim() !== '';
  const stageConfig = getStageConfig(stageCode);

  const handleSubmit = () => {
    onSubmit(quantity, packagingType, notes);
    setQuantity('');
    setPackagingType('');
    setNotes('');
  };

  return (
    <section className="space-y-5 rounded-[32px] border border-outline-variant/10 bg-white p-6 shadow-sm dark:bg-surface-container-lowest">
      <div className="flex items-center gap-4">
        <div className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl', stageConfig.bgAccent, stageConfig.textAccent)}>
          <MaterialSymbol name="inventory_2" tone="primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-tight text-on-surface">{operation.name}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {stageConfig.labelUk} · Упаковка
          </p>
        </div>
      </div>

      <PackagingForm
        quantityValue={quantity}
        packagingType={packagingType}
        notesValue={notes}
        onQuantityChange={setQuantity}
        onPackagingTypeChange={setPackagingType}
        onNotesChange={setNotes}
        onSubmit={handleSubmit}
        saving={saving}
        isReady={isReady}
      />

      {entries.length > 0 && (
        <div className="pt-2">
          <EntryHistory entries={entries} stageCode={stageCode} emptyMessage="Ще немає записів" />
        </div>
      )}
    </section>
  );
}

export function DynamicFormOperationCard({
  operation,
  entries,
  draft,
  setDraft,
  onSubmit,
  availableColors,
  saving,
  stageCode,
}: {
  operation: StageOp;
  entries: Entry[];
  draft: Record<string, any>;
  setDraft: (next: Record<string, any>) => void;
  onSubmit: () => void;
  availableColors: Array<{ color: string; rolls: number }>;
  saving: boolean;
  stageCode: string | null;
}) {
  const fields = Array.isArray(operation.field_schema) ? operation.field_schema : [];
  const ready = isDraftReady(fields, draft);
  const stageConfig = getStageConfig(stageCode);

  return (
    <section className="space-y-6 rounded-[32px] border border-outline-variant/10 bg-white p-6 shadow-sm dark:bg-surface-container-lowest">
      <div className="flex items-center gap-4">
        <div className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl', stageConfig.bgAccent, stageConfig.textAccent)}>
          <MaterialSymbol name="settings_input_component" tone="primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-tight text-on-surface">{operation.name}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {operation.code} · {fields.length} полів
          </p>
        </div>
      </div>

      {fields.length > 0 ? (
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
                  {field.label}
                </span>
                {field.required && <span className="text-primary">*</span>}
              </div>
              <FieldInput
                field={field}
                value={draft[field.key]}
                availableColors={availableColors}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    [field.key]: value,
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border-2 border-dashed border-outline-variant/10 py-8 text-center">
          <span className="text-sm font-medium italic text-on-surface-variant/40">Схема полів відсутня</span>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={saving || !ready}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-primary text-sm font-black text-white shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
      >
        {saving ? <MaterialSymbol name="sync" tone="primary" spin filled /> : <MaterialSymbol name="add_task" tone="primary" />}
        Додати запис
      </button>

      {entries.length > 0 && (
        <div className="pt-2">
          <EntryHistory entries={entries} stageCode={stageCode} emptyMessage="Ще немає записів" />
        </div>
      )}
    </section>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  batchNumber,
  modelName,
  entriesCount,
  quantityTotal,
  busy,
  confirmButtonText,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  batchNumber: string;
  modelName: string;
  entriesCount: number;
  quantityTotal: number;
  busy: boolean;
  confirmButtonText?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-md">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-[40px] border border-outline-variant/10 bg-white p-8 text-center shadow-2xl animate-in fade-in zoom-in duration-300 dark:bg-surface-container-lowest">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MaterialSymbol name="verified" size="xl" tone="primary" filled />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-on-surface">Завершити етап?</h2>
          <p className="text-sm font-bold leading-tight text-on-surface-variant/60">
            Ви завершите роботу по партії <span className="text-on-surface">{batchNumber}</span>
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 rounded-[24px] bg-surface-container-low p-4">
          <div className="flex flex-col items-center border-r border-outline-variant/10">
            <span className="mb-1 text-[10px] font-bold uppercase text-on-surface-variant/40">Записів</span>
            <span className="text-lg font-black text-on-surface">{entriesCount}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="mb-1 text-[10px] font-bold uppercase text-on-surface-variant/40">Готово</span>
            <span className="text-lg font-black text-on-surface">{quantityTotal} шт</span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-primary text-sm font-black text-white shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-60"
          >
            {busy ? <MaterialSymbol name="sync" tone="primary" spin /> : <MaterialSymbol name="task_alt" tone="primary" />}
            {confirmButtonText || 'Так, завершити'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-12 w-full text-sm font-bold text-on-surface-variant transition-all active:scale-95 disabled:opacity-60"
          >
            Повернутись до роботи
          </button>
        </div>
      </div>
    </div>
  );
}

export function ValidationModal({
  errors,
  onClose,
}: {
  errors: Array<{ field: string; label: string; operation: string }>;
  onClose: () => void;
}) {
  if (errors.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-[40px] border border-red-100 bg-white p-8 text-center shadow-2xl animate-in fade-in zoom-in duration-300 dark:border-red-900/30 dark:bg-surface-container-lowest">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/20">
          <MaterialSymbol name="warning" size="xl" tone="red" filled />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-on-surface">Помилка валідації</h2>
          <p className="text-sm font-bold leading-tight text-on-surface-variant/60">
            Необхідно виправити наступні зауваження перед завершенням:
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          {errors.map((error, index) => (
            <div
              key={index}
              className="rounded-[20px] border border-red-100 bg-red-50 p-4 text-left dark:border-red-900/20 dark:bg-red-900/10"
            >
              <p className="text-xs font-black leading-tight text-red-700 dark:text-red-400">{error.label}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-on-surface text-surface text-sm font-black transition-all active:scale-95"
        >
          <MaterialSymbol name="close" tone="neutral" />
          Зрозуміло
        </button>
      </div>
    </div>
  );
}

export { EmbroideryQueueCard };
