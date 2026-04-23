'use client';

import { useState } from 'react';
import { extractQuantity, extractDefectQuantity } from '@/lib/stageConfig';
import clsx from 'clsx';

type Entry = {
  id: number | string;
  operation_name?: string | null;
  operation_code?: string | null;
  entry_number: number;
  quantity: number | null;
  data: Record<string, any>;
  notes: string | null;
  recorded_at: string;
};

type EntryHistoryProps = {
  entries: Entry[];
  stageCode: string | null;
  emptyMessage?: string;
};

function formatTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function EntryCard({
  entry,
  index,
}: {
  entry: Entry;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const quantity = extractQuantity(entry.data) || Number(entry.quantity || 0);
  const defectQty = extractDefectQuantity(entry.data);
  const operationName = entry.operation_name || 'Операція';
  const recordedAt = formatTimestamp(entry.recorded_at);

  const d = entry.data || {};
  const detailEntries = Object.entries(d)
    .filter(([key, value]) => {
      if (key === 'notes') return false;
      if (['quantity', 'quantity_done', 'defect_quantity'].includes(key)) return false;
      return value !== null && value !== undefined && value !== '';
    })
    .slice(0, 8);

  return (
    <div className="bg-surface-container-low/50 dark:bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-xl">history</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">
                №{entry.entry_number || index + 1}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant/40 leading-none">
                {recordedAt}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {quantity} шт
              </span>
              {defectQty > 0 && (
                <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded">
                  {defectQty} брак
                </span>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant/40 active:scale-90 transition-all"
        >
          <span className="material-symbols-outlined">{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/5">
            {detailEntries.map(([key, value]) => (
              <div key={key} className="bg-surface-container/30 rounded-xl p-2.5">
                <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest leading-none mb-1">{key}</p>
                <p className="text-xs font-black text-on-surface leading-none">{String(value)}</p>
              </div>
            ))}
            {entry.notes && (
              <div className={clsx("col-span-2 p-3 rounded-xl flex items-start gap-2", "bg-amber-50 dark:bg-amber-900/10 border border-amber-200/30")}>
                <span className="material-symbols-outlined text-[14px] text-amber-600">notes</span>
                <p className="text-[11px] italic text-amber-800 dark:text-amber-200/70">{entry.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EntryHistory({
  entries,
  stageCode,
  emptyMessage,
}: EntryHistoryProps) {
  if (entries.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center justify-center text-center opacity-40">
        <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
        <p className="text-xs font-bold uppercase tracking-widest">{emptyMessage || 'Записи відсутні'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
          Історія записів
        </h4>
        <span className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-black text-primary uppercase">
          {entries.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {entries.map((entry, index) => (
          <EntryCard
            key={String(entry.id)}
            entry={entry}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
