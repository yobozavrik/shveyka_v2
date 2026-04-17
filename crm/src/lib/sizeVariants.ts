/**
 * Утилиты для работы с размерными сетками (Взрослые / Детские).
 * Автоматическое определение типа по названию модели.
 */

// ──── Константы ────

export const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] as const;
export type AdultSize = typeof ADULT_SIZES[number];

export const CHILD_SIZES = [
  '86', '92', '98', '104', '110', '116', '122', '128', '134', '140', '146', '152', '164'
] as const;
export type ChildSize = typeof CHILD_SIZES[number];

/** Ключевые слова, указывающие на детскую одежду */
const CHILD_KEYWORDS = [
  'хлопчик', 'хлопч',
  'дівчинк', 'дівч',
  'дитяч', 'дит',
  'немовлят', 'немовл',
  'бебі', 'baby',
  'юніор', 'junior',
  'підліт', 'teen',
  'дит', 'kid', 'kids'
];

// ──── Хелперы ────

/** Определяет, является ли набор размеров детским */
export function isChildSizeSet(sizes: string[]): boolean {
  // Если все размеры есть в CHILD_SIZES и есть хотя бы один размер
  return sizes.length > 0 && sizes.every(s => CHILD_SIZES.includes(s as ChildSize));
}

/** Извлекает список размеров из объекта size_variants */
export function extractSelectedSizes(variants: any): string[] {
  if (!variants) return [];
  if (Array.isArray(variants)) return variants.map(String);
  if (variants.selected_sizes && Array.isArray(variants.selected_sizes)) return variants.selected_sizes.map(String);
  // Если это объект вида { S: 10, M: 20 }
  if (typeof variants === 'object') return Object.keys(variants);
  return [];
}

/** Получает количество по каждому размеру из size_variants */
export function extractSizeVariantQuantities(variants: any): Record<string, number> {
  if (!variants) return {};
  if (Array.isArray(variants)) return {};
  if (variants.selected_sizes && Array.isArray(variants.selected_sizes)) return {};
  if (typeof variants === 'object') {
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(variants)) {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) result[key] = num;
    }
    return result;
  }
  return {};
}

/** Определяет тип размерной сетки по названию модели или позиции заказа */
export function detectSizeType(name?: string | null): 'child' | 'adult' {
  if (!name) return 'adult';
  const lower = name.toLowerCase();
  const hasChildKeyword = CHILD_KEYWORDS.some(kw => lower.includes(kw));
  return hasChildKeyword ? 'child' : 'adult';
}

/** Возвращает список размеров по типу */
export function getSizesByType(type: 'child' | 'adult'): readonly string[] {
  return type === 'child' ? CHILD_SIZES : ADULT_SIZES;
}
