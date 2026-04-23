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
  | 'embroidery'
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
    labelUk: 'Розкрой',
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
    labelUk: 'Распошив',
    icon: Combine,
    color: 'violet',
    bgAccent: 'bg-violet-500/15',
    borderAccent: 'border-violet-200',
    textAccent: 'text-violet-500',
    completeButtonText: 'Завершити распошив',
    description: 'Распошивальна обробка',
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
  embroidery: {
    code: 'embroidery',
    label: 'Embroidery',
    labelUk: 'Вишивка',
    icon: Package2,
    color: 'indigo',
    bgAccent: 'bg-indigo-500/15',
    borderAccent: 'border-indigo-200',
    textAccent: 'text-indigo-500',
    completeButtonText: 'Завершити вишивку',
    description: 'Вишивальна обробка',
  },
};

export function getStageConfig(code: string | null | undefined): StageConfig {
  if (!code) return STAGE_CONFIG.cutting;
  return STAGE_CONFIG[code.toLowerCase()] || STAGE_CONFIG.cutting;
}

export function getStageColorKey(code: string | null | undefined): string {
  return getStageConfig(code).color;
}

/**
 * Extracts quantity value from entry data based on operation code.
 * Handles various field naming conventions.
 */
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

/**
 * Extracts defect/brak quantity from entry data.
 */
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

/**
 * Checks if a stage is a cutting stage.
 */
export function isCuttingStage(code: string | null | undefined): boolean {
  return code?.toLowerCase() === 'cutting';
}

/**
 * Checks if a stage is packaging.
 */
export function isPackagingStage(code: string | null | undefined): boolean {
  return code?.toLowerCase() === 'packaging';
}

/**
 * Checks if a stage uses simple quantity + defect form (sewing, overlock, etc).
 */
export function isSimpleQuantityStage(code: string | null | undefined): boolean {
  const simpleStages = ['sewing', 'overlock', 'straight_stitch', 'coverlock'];
  return simpleStages.includes(code?.toLowerCase() || '');
}

/**
 * Returns appropriate completion button text for a stage.
 */
export function getCompleteButtonText(code: string | null | undefined): string {
  return getStageConfig(code).completeButtonText;
}

/**
 * Returns icon component for a stage.
 */
export function getStageIcon(code: string | null | undefined): LucideIcon {
  return getStageConfig(code).icon;
}
