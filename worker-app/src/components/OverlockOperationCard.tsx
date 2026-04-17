'use client';

import { useEffect, useMemo, useState } from 'react';
import MaterialSymbol from '@/components/MaterialSymbol';
import { type Entry } from '@/components/task-page-shared';
import { getStageConfig } from '@/lib/stageConfig';

type RowState = {
  size: string;
  plannedQty: number;
  quantity: string;
  defectQuantity: string;
};

function toNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function buildInitialRows(sizeRows: OverlockSizePlanRow[]): RowState[] {
  return sizeRows.map((row) => ({
    size: row.size,
    plannedQty: row.planned_qty,
    quantity: String(row.planned_qty),
    defectQuantity: '0',
  }));
}

type OverlockSizePlanRow = {
  size: string;
  planned_qty: number;
};

function extractEntrySizeRows(entry: Entry): Array<{ size: string; quantity: number; defect_quantity: number }> {
  const data = entry.data || {};

  if (Array.isArray(data.size_rows)) {
    return data.size_rows
      .map((row: any) => ({
        size: String(row?.size || '').trim(),
        quantity: Number(row?.quantity || 0),
        defect_quantity: Number(row?.defect_quantity || 0),
      }))
      .filter((row) => Boolean(row.size));
  }

  if (data.size_breakdown && typeof data.size_breakdown === 'object') {
    return Object.entries(data.size_breakdown).map(([size, quantity]) => ({
      size: String(size).trim(),
      quantity: Number(quantity) || 0,
      defect_quantity: 0,
    }));
  }

  return [];
}

export default function OverlockOperationCard({
  operation,
  entries,
  stageCode,
  sizeRows,
  saving,
  onSubmit,
}: {
  operation: { id: number; code: string; name: string };
  entries: Entry[];
  stageCode: string | null;
  sizeRows: OverlockSizePlanRow[];
  saving: boolean;
  onSubmit: (rows: Array<{ size: string; quantity: number; defect_quantity: number }>, notes: string) => void;
}) {
  const stageConfig = getStageConfig(stageCode);
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(sizeRows));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setRows(buildInitialRows(sizeRows));
  }, [sizeRows]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.planned += row.plannedQty;
        acc.quantity += toNumber(row.quantity);
        acc.defect += toNumber(row.defectQuantity);
        return acc;
      },
      { planned: 0, quantity: 0, defect: 0 },
    );
  }, [rows]);

  const isReady =
    rows.length > 0 &&
    rows.every((row) => {
      const quantity = toNumber(row.quantity);
      const defect = toNumber(row.defectQuantity);
      return quantity >= 0 && defect >= 0 && quantity <= row.plannedQty && defect <= quantity;
    });

  const handleSubmit = () => {
    onSubmit(
      rows.map((row) => ({
        size: row.size,
        quantity: toNumber(row.quantity),
        defect_quantity: toNumber(row.defectQuantity),
      })),
      notes.trim(),
    );
  };

  return (
    <section className="space-y-5 rounded-[32px] border border-outline-variant/10 bg-white p-6 shadow-sm dark:bg-surface-container-lowest">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stageConfig.bgAccent} ${stageConfig.textAccent}`}>
          <MaterialSymbol name="playlist_add_check" tone="primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-tight text-on-surface">{operation.name}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {stageConfig.labelUk} · розмірна сітка та брак
          </p>
        </div>
      </div>

      <div className="rounded-[24px] border border-purple-100 bg-purple-50/60 p-4 text-sm text-[var(--text-2)]">
        На оверлок передається кількість із розкрою. Фактичний вихід плюс брак по розміру не можуть перевищувати план.
      </div>

      <div className="space-y-3 rounded-[28px] border border-outline-variant/10 bg-[var(--bg-base)] p-4">
        <div className="grid grid-cols-[1.1fr,0.8fr,0.8fr,0.8fr] gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
          <span>Розмір</span>
          <span>План</span>
          <span>Факт</span>
          <span>Брак</span>
        </div>

        <div className="space-y-2">
          {rows.map((row, index) => {
            const quantity = toNumber(row.quantity);
            const defect = toNumber(row.defectQuantity);
            const remaining = Math.max(0, row.plannedQty - quantity);

            return (
              <div key={row.size} className="grid grid-cols-[1.1fr,0.8fr,0.8fr,0.8fr] gap-2 rounded-[20px] border border-outline-variant/10 bg-white p-3">
                <div className="flex items-center">
                  <div className="rounded-2xl bg-purple-500/10 px-3 py-2 text-sm font-black text-purple-600">
                    {row.size}
                  </div>
                </div>
                <div className="flex items-center text-sm font-black text-[var(--text-1)]">
                  {row.plannedQty}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="sr-only">Факт {row.size}</span>
                  <input
                    type="number"
                    min={0}
                    max={row.plannedQty}
                    value={row.quantity}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, currentIndex) =>
                          currentIndex === index
                            ? { ...item, quantity: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-bold outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="sr-only">Брак {row.size}</span>
                  <input
                    type="number"
                    min={0}
                    max={row.plannedQty}
                    value={row.defectQuantity}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, currentIndex) =>
                          currentIndex === index
                            ? { ...item, defectQuantity: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-bold outline-none"
                  />
                </label>
                <div className="col-span-4 mt-2 grid grid-cols-3 gap-2 text-[11px] font-bold text-[var(--text-3)]">
                  <span>Залишок: {remaining}</span>
                  <span>Брак рахується окремо</span>
                  <span className={remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                    {remaining === 0 ? 'Норма' : 'Перевірити'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">Коментар</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Примітка по браку або виконанню"
          className="w-full rounded-[24px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
        />
      </label>

      <div className="grid grid-cols-3 gap-2 rounded-[24px] bg-[var(--bg-base)] p-4 text-sm font-bold text-[var(--text-2)]">
        <div>План: {summary.planned}</div>
        <div>Факт: {summary.quantity}</div>
        <div>Брак: {summary.defect}</div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || !isReady}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-purple-600 px-4 py-4 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-60"
      >
        {saving ? <MaterialSymbol name="sync" tone="primary" spin /> : <MaterialSymbol name="add_task" tone="primary" />}
        Зберегти оверлок
      </button>

      {entries.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Історія записів
            </span>
            <span className="text-[10px] font-black uppercase text-purple-600">{entries.length} записів</span>
          </div>
          <div className="space-y-2">
            {entries.map((entry, index) => {
              const sizeRows = extractEntrySizeRows(entry);
              const totalQty = sizeRows.reduce((sum, row) => sum + row.quantity, 0) || Number(entry.quantity || 0);
              const totalDefect = sizeRows.reduce((sum, row) => sum + row.defect_quantity, 0);
              const timestamp = entry.recorded_at
                ? new Date(entry.recorded_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
                : '—';

              return (
                <div key={String(entry.id)} className="rounded-[24px] border border-outline-variant/10 bg-[var(--bg-base)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-[var(--text-1)]">
                        #{index + 1} · {entry.operation_name || operation.name}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                        {timestamp}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-purple-600">{totalQty} шт</div>
                      {totalDefect > 0 && (
                        <div className="text-[10px] font-bold text-red-500">{totalDefect} брак</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {sizeRows.map((row) => (
                      <div key={`${entry.id}-${row.size}`} className="grid grid-cols-[1fr,0.7fr,0.7fr] gap-2 rounded-[18px] border border-outline-variant/10 bg-white px-3 py-2 text-sm">
                        <div className="font-bold text-[var(--text-1)]">{row.size}</div>
                        <div className="font-bold text-[var(--text-2)]">Факт: {row.quantity}</div>
                        <div className="font-bold text-red-500">Брак: {row.defect_quantity}</div>
                      </div>
                    ))}
                    {entry.notes && (
                      <div className="rounded-[18px] border border-amber-200/40 bg-amber-50 px-3 py-2 text-xs italic text-amber-800">
                        {entry.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
