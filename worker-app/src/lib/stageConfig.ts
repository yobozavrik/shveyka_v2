import {
  Scissors,
  Package2,
  Shirt,
  Layers,
  Combine,
  Box,
  type LucideIcon,
} from 'lucide-react';

export type StageCode =
  | 'cutting'
  | 'sewing'
  | 'overlock'
  | 'straight_stitch'
  | 'coverlock'
  | 'packaging'
  | string;

export type StageConfig = {
  code: StageCode;
  label: string;
  labelUk: string;
  icon: LucideIcon;
  color: string;
  bgAccent: string;
  borderAccent: string;
  textAccent: string;
  completeButtonText: string;
  description: string;
};

export const STAGE_CONFIG: Record<string, StageConfig> = {
  cutting: {
    code: 'cutting',
    label: 'Cutting',
    labelUk: 'Розкрій',
    icon: Scissors,
    color: 'emerald',
    bgAccent: 'bg-emerald-500/15',
    borderAccent: 'border-emerald-200',
    textAccent: 'text-emerald-500',
    completeButtonText: 'Завершити розкрій',
    description: 'Настил та крій тканини',
  },
  sewing: {
    code: 'sewing',
    label: 'Sewing',
    labelUk: 'Пошив',
    icon: Shirt,
    color: 'blue',
    bgAccent: 'bg-blue-500/15',
    borderAccent: 'border-blue-200',
    textAccent: 'text-blue-500',
    completeButtonText: 'Завершити пошив',
    description: 'Пошив виробів',
  },
  overlock: {
    code: 'overlock',
    label: 'Overlock',
    labelUk: 'Оверлок',
    icon: Layers,
    color: 'purple',
    bgAccent: 'bg-purple-500/15',
    borderAccent: 'border-purple-200',
    textAccent: 'text-purple-500',
    completeButtonText: 'Завершити оверлок',
    description: 'Оверлочна обробка',
  },
  straight_stitch: {
    code: 'straight_stitch',
    label: 'Straight Stitch',
    labelUk: 'Прямострочка',
    icon: Package2,
    color: 'indigo',
    bgAccent: 'bg-indigo-500/15',
    borderAccent: 'border-indigo-200',
    textAccent: 'text-indigo-500',
    completeButtonText: 'Завершити прямострочку',
    description: 'Пряма строчка',
  },
  coverlock: {
    code: 'coverlock',
    label: 'Coverlock',
    labelUk: 'Розпошив',
    icon: Combine,
    color: 'violet',
    bgAccent: 'bg-violet-500/15',
    borderAccent: 'border-violet-200',
    textAccent: 'text-violet-500',
    completeButtonText: 'Завершити розпошив',
    description: 'Розпошивальна обробка',
  },
  packaging: {
    code: 'packaging',
    label: 'Packaging',
    labelUk: 'Упаковка',
    icon: Box,
    color: 'orange',
    bgAccent: 'bg-orange-500/15',
    borderAccent: 'border-orange-200',
    textAccent: 'text-orange-500',
    completeButtonText: 'Завершити упаковку',
    description: 'Упаковка готових виробів',
  },
};

const STAGE_ALIASES: Record<string, string> = {
  flatlock: 'coverlock',
};

function normalizeStageCode(code: string | null | undefined): string {
  const normalized = (code || '').toLowerCase();
  return STAGE_ALIASES[normalized] || normalized;
}

export function getStageConfig(code: string | null | undefined): StageConfig {
  const normalized = normalizeStageCode(code);
  if (!normalized) return STAGE_CONFIG.cutting;
  return STAGE_CONFIG[normalized] || STAGE_CONFIG.cutting;
}

export function getStageColorKey(code: string | null | undefined): string {
  return getStageConfig(code).color;
}

export function extractQuantity(data: Record<string, any> | null | undefined): number {
  if (!data) return 0;

  const quantityKeys = [
    'quantity',
    'quantity_done',
    'quantity_cut',
    'quantity_packed',
    'quantity_per_nastil',
    'done_quantity',
    'completed_quantity',
  ];

  for (const key of quantityKeys) {
    const value = data[key];
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }

  return 0;
}

export function extractDefectQuantity(data: Record<string, any> | null | undefined): number {
  if (!data) return 0;

  const defectKeys = [
    'defect_quantity',
    'defect',
    'brak',
    'brak_quantity',
    'rejected_quantity',
    'waste_quantity',
  ];

  for (const key of defectKeys) {
    const value = data[key];
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }

  return 0;
}

export function isCuttingStage(code: string | null | undefined): boolean {
  return normalizeStageCode(code) === 'cutting';
}

export function isPackagingStage(code: string | null | undefined): boolean {
  return normalizeStageCode(code) === 'packaging';
}

export function isSimpleQuantityStage(code: string | null | undefined): boolean {
  const simpleStages = ['sewing', 'straight_stitch', 'coverlock'];
  return simpleStages.includes(normalizeStageCode(code));
}

export function isOverlockStage(code: string | null | undefined): boolean {
  return normalizeStageCode(code) === 'overlock';
}

export function getCompleteButtonText(code: string | null | undefined): string {
  return getStageConfig(code).completeButtonText;
}

export function getStageIcon(code: string | null | undefined): LucideIcon {
  return getStageConfig(code).icon;
}
