export type SizeVariantsInput = Record<string, unknown> | string[] | null | undefined;

function normalizeSizeLabel(value: unknown): string {
  return String(value ?? '').trim();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function extractSelectedSizes(value: SizeVariantsInput): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(normalizeSizeLabel).filter(Boolean);
  }

  const raw = value as Record<string, unknown>;

  if (Array.isArray(raw.selected_sizes)) {
    return raw.selected_sizes.map(normalizeSizeLabel).filter(Boolean);
  }

  if (Array.isArray(raw.sizes)) {
    return raw.sizes.map(normalizeSizeLabel).filter(Boolean);
  }

  return Object.entries(raw)
    .filter(([key, entry]) => key !== 'selected_sizes' && key !== 'sizes' && isFiniteNumber(entry))
    .map(([key]) => normalizeSizeLabel(key))
    .filter(Boolean);
}

export function extractSizeVariantQuantities(value: SizeVariantsInput): Record<string, number> {
  if (!value || Array.isArray(value)) return {};

  const raw = value as Record<string, unknown>;
  const result: Record<string, number> = {};

  for (const [key, entry] of Object.entries(raw)) {
    if (key === 'selected_sizes' || key === 'sizes') continue;
    if (Array.isArray(entry)) continue;

    const numeric = typeof entry === 'string' ? Number(entry) : entry;
    if (typeof numeric === 'number' && Number.isFinite(numeric)) {
      result[key] = numeric;
    }
  }

  return result;
}
