'use client';

import { useState } from 'react';
import MaterialSymbol from '@/components/MaterialSymbol';

type FieldSchema = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  required?: boolean;
  source?: string;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
};

type Entry = {
  id: number | string;
  task_id: number;
  batch_id: number;
  employee_id: number;
  stage_id: number | null;
  operation_id: number | null;
  entry_number: number;
  quantity: number | null;
  data: Record<string, any>;
  notes: string | null;
  recorded_at: string;
  source?: string;
  operation_code?: string | null;
  operation_name?: string | null;
};

export type { FieldSchema, Entry };

export function FieldInput({
  field,
  value,
  onChange,
  availableColors,
}: {
  field: FieldSchema;
  value: any;
  onChange: (value: any) => void;
  availableColors: Array<{ color: string; rolls: number }>;
}) {
  if (field.key === 'nastil_number') {
    return (
      <div className="space-y-1.5">
        <input
          type="text"
          value={String(value ?? '')}
          readOnly
          className="w-full cursor-not-allowed rounded-2xl border border-[var(--border)] bg-[var(--bg-card2)] px-4 py-3 text-sm font-black outline-none"
        />
        <div className="text-[10px] font-semibold text-[var(--text-3)]">
          Номер призначається автоматично. 1 запис = 1 рулон = 1 настил.
        </div>
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text-1)]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)]"
        />
        <span>{field.placeholder || 'Так / Ні'}</span>
      </label>
    );
  }

  if (field.type === 'select' && field.source === 'batch_colors' && availableColors.length > 0) {
    return (
      <select
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
      >
        <option value="">Оберіть значення</option>
        {availableColors.map((color, index) => (
          <option key={`${color.color}-${index}`} value={color.color}>
            {color.color}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
    return (
      <select
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
      >
        <option value="">Оберіть значення</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      step={
        field.type === 'number'
          ? field.key.includes('weight')
            ? '0.1'
            : field.key.includes('length')
              ? '0.01'
              : '1'
          : undefined
      }
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder || field.label}
      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
    />
  );
}

export function NastilEntryCard({
  entry,
  index,
  selectedSizes,
}: {
  entry: Entry;
  index: number;
  selectedSizes: string[];
}) {
  const [expanded, setExpanded] = useState(true);

  const d = entry.data || {};
  const nastilNumber = d.nastil_number ?? String(index + 1);
  const fabricColor = String(d.fabric_color || '—');
  const qtyPerSize = Number(d.quantity_per_nastil ?? entry.quantity ?? 0);
  const reelWidth = d.reel_width_cm != null ? Number(d.reel_width_cm) : null;
  const reelLength = d.reel_length_m != null ? Number(d.reel_length_m) : null;
  const weightKg = d.weight_kg != null ? Number(d.weight_kg) : null;
  const remainderKg = d.remainder_kg != null ? Number(d.remainder_kg) : null;
  const totalQty = qtyPerSize * (selectedSizes.length || 1);

  const recordedAt = entry.recorded_at
    ? new Date(entry.recorded_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="overflow-hidden rounded-[28px] border border-outline-variant/10 bg-white shadow-sm transition-all duration-300 dark:bg-surface-container-lowest">
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MaterialSymbol name="content_cut" tone="primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black leading-none text-on-surface">№{nastilNumber}</span>
              <span className="rounded-md bg-surface-container px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {recordedAt}
              </span>
            </div>
            <p className="mt-1 text-xs font-bold uppercase tracking-tighter text-on-surface-variant/50">
              Колір: {fabricColor}
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-all active:scale-90"
        >
          <MaterialSymbol name={expanded ? 'expand_less' : 'expand_more'} size="sm" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[20px] border border-outline-variant/5 bg-surface-container-low p-3">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                На кожен розмір
              </p>
              <p className="text-lg font-black leading-none text-primary">
                {qtyPerSize} <span className="text-[10px] opacity-40">шт.</span>
              </p>
            </div>
            <div className="rounded-[20px] border border-primary/10 bg-primary/5 p-3">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-primary/40">
                Всього по настилу
              </p>
              <p className="text-lg font-black leading-none text-primary">
                {totalQty} <span className="text-[10px] opacity-40">шт.</span>
              </p>
            </div>
          </div>

          {selectedSizes.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {selectedSizes.map((size) => (
                  <div
                    key={size}
                    className="flex min-w-[56px] flex-1 flex-col items-center rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-2"
                  >
                    <span className="mb-1 w-full border-b border-outline-variant/5 pb-1 text-center text-[9px] font-black uppercase text-on-surface-variant/40">
                      {size}
                    </span>
                    <span className="text-sm font-black text-on-surface">{qtyPerSize}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Ширина', val: reelWidth, unit: 'см' },
              { label: 'Довжина', val: reelLength, unit: 'м' },
              { label: 'Вага', val: weightKg, unit: 'кг' },
              { label: 'Залишок', val: remainderKg, unit: 'кг' },
            ]
              .filter((item) => item.val != null)
              .map((item, i) => (
                <div key={i} className="flex flex-col">
                  <span className="mb-1 text-[8px] font-bold uppercase leading-none text-on-surface-variant/30">
                    {item.label}
                  </span>
                  <span className="text-[11px] font-black text-on-surface-variant">
                    {item.val} {item.unit}
                  </span>
                </div>
              ))}
          </div>

          {entry.notes && (
            <div className="mt-1 rounded-2xl border border-outline-variant/5 bg-surface-container-low/50 p-3">
              <p className="text-[11px] italic text-on-surface-variant/60">"{entry.notes}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmbroideryQueueCard({
  nastils,
  selectedSizes,
}: {
  nastils: Entry[];
  selectedSizes: string[];
}) {
  if (nastils.length === 0) return null;

  return (
    <section className="glass space-y-5 rounded-[2rem] border-indigo-500/20 bg-indigo-500/5 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-indigo-500/15 p-3 text-indigo-500">
          <MaterialSymbol name="edit_note" tone="indigo" />
        </div>
        <div>
          <div className="text-sm font-black text-[var(--text-1)]">Черга вишивки</div>
          <div className="text-xs text-[var(--text-3)]">{nastils.length} настилів передано</div>
        </div>
      </div>

      <div className="space-y-3">
        {nastils.map((nastil, index) => {
          const d = nastil.data || {};
          const nastilNumber = d.nastil_number ?? String(index + 1);
          const fabricColor = String(d.fabric_color || '—');
          const embType = d.embroidery_type || '—';
          const embColor = d.embroidery_color || '—';
          const qty = Number(d.quantity_per_nastil ?? nastil.quantity ?? 0);
          const total = qty * (selectedSizes.length || 1);
          const sentAt = d.embroidery_sent_at
            ? new Date(d.embroidery_sent_at).toLocaleString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—';

          return (
            <div key={String(nastil.id)} className="space-y-3 rounded-2xl border border-indigo-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Настил</div>
                  <div className="text-lg font-black text-[var(--text-1)]">№{nastilNumber}</div>
                  <div className="text-xs font-semibold text-[var(--text-2)]">
                    {fabricColor !== '—' ? fabricColor.toLowerCase() : '—'}
                    {qty > 0 ? ` · ${qty} шт на розмір` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-black uppercase tracking-widest text-[var(--text-3)]">Всього</div>
                  <div className="text-lg font-black tabular-nums text-indigo-600">{total > 0 ? total : qty} шт</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-indigo-50 px-3 py-2 text-indigo-700">
                  <div className="text-[9px] font-black uppercase tracking-widest opacity-70">Тип</div>
                  <div className="mt-1 font-bold">{embType}</div>
                </div>
                <div className="rounded-xl bg-indigo-50 px-3 py-2 text-indigo-700">
                  <div className="text-[9px] font-black uppercase tracking-widest opacity-70">Колір</div>
                  <div className="mt-1 font-bold">{embColor}</div>
                </div>
              </div>

              <div className="text-[10px] font-semibold text-[var(--text-3)]">Передано: {sentAt}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
