'use client';

import { getStageConfig } from '@/lib/stageConfig';
import MaterialSymbol from '@/components/MaterialSymbol';

type StageHeaderProps = {
  stageCode: string | null;
  stageName: string;
  progressText: string;
  planQuantity: number;
};

export default function StageHeader({
  stageCode,
  stageName,
  progressText,
  planQuantity,
}: StageHeaderProps) {
  const stageConfig = getStageConfig(stageCode);
  const stageTone =
    stageConfig.code === 'cutting'
      ? 'emerald'
      : stageConfig.code === 'sewing'
        ? 'blue'
        : stageConfig.code === 'overlock'
          ? 'violet'
          : stageConfig.code === 'straight_stitch'
            ? 'indigo'
            : stageConfig.code === 'coverlock'
              ? 'violet'
              : 'orange';
  const iconName =
    stageConfig.code === 'cutting'
      ? 'content_cut'
      : stageConfig.code === 'packaging'
        ? 'inventory_2'
        : stageConfig.code === 'sewing'
          ? 'edit_square'
          : stageConfig.code === 'overlock'
            ? 'layers'
            : stageConfig.code === 'straight_stitch'
              ? 'package_2'
              : stageConfig.code === 'coverlock'
                ? 'join'
                : 'layers';

  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`rounded-2xl p-3 ${stageConfig.bgAccent} ${stageConfig.textAccent}`}>
            <MaterialSymbol name={iconName} tone={stageTone} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
              Етап
            </div>
            <div className="mt-1 text-sm font-black text-[var(--text-1)]">
              {stageName}
              {stageConfig.labelUk ? ` · ${stageConfig.labelUk}` : ''}
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
    </section>
  );
}
