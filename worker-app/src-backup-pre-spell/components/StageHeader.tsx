'use client';

import { type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

type StageHeaderProps = {
  stageName: string;
  stageCode: string | null;
  progressText: string;
  planQuantity: number;
  icon: LucideIcon;
  color: string;
  bgAccent: string;
};

export default function StageHeader({
  stageName,
  stageCode,
  progressText,
  planQuantity,
  icon: Icon,
  bgAccent,
}: StageHeaderProps) {
  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={clsx('rounded-2xl p-3', bgAccent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Етап
            </div>
            <div className="mt-1 text-sm font-black text-[var(--text-1)]">
              {stageName}
              {stageCode ? ` · ${stageCode}` : ''}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
            Прогрес
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-1)]">
            {progressText}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--bg-base)] px-4 py-3">
        <div className="text-xs font-bold text-[var(--text-2)]">План:</div>
        <div className="text-sm font-black text-[var(--text-1)]">
          {planQuantity || 0} шт
        </div>
      </div>
    </div>
  );
}
