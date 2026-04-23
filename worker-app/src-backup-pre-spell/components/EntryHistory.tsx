'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { extractQuantity, extractDefectQuantity } from '@/lib/stageConfig';

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
    return new Date(timestamp).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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
    .slice(0, 6);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-widest text-[var(--text-3)]">
            {operationName}
          </div>
          <div className="text-lg font-black text-[var(--text-1)]">
            #{entry.entry_number || index + 1}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-[var(--text-2)]">
            <span className="text-emerald-500">✓ {quantity} шт</span>
            {defectQty > 0 && (
              <>
                <span>·</span>
                <span className="text-red-500">✗ {defectQty} брак</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-2 text-[var(--text-3)] hover:bg-[var(--bg-card2)]"
          aria-label={expanded ? 'Згорнути' : 'Розгорнути'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Footer - timestamp */}
      <div className="border-t border-[var(--border)] px-4 py-3">
        <div className="text-[10px] font-semibold text-[var(--text-3)]">
          {recordedAt}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--border)] p-4 space-y-3">
          {detailEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {detailEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl bg-[var(--bg-card)] p-3"
                >
                  <div className="text-[9px] font-black uppercase tracking-widest text-[var(--text-3)] mb-1">
                    {key}
                  </div>
                  <div className="text-sm font-black text-[var(--text-1)]">
                    {String(value)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {entry.notes && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">
                Примітка
              </div>
              <div className="text-xs font-semibold text-amber-800">
                {entry.notes}
              </div>
            </div>
          )}
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
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-base)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
        {emptyMessage || 'Ще немає записів для цього етапу'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
        Історія записів: {entries.length}
      </div>
      {entries.map((entry, index) => (
        <EntryCard
          key={String(entry.id)}
          entry={entry}
          index={index}
        />
      ))}
    </div>
  );
}
