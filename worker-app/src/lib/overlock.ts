export type SizeQuantityMap = Record<string, number>;

export type OverlockSizeRow = {
  size: string;
  planned_qty: number;
  quantity: number;
  defect_quantity: number;
};

function toFiniteInteger(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0;
}

export function normalizeSizeLabel(value: unknown): string {
  return String(value ?? '').trim();
}

export function extractSizeBreakdown(source: Record<string, any> | null | undefined): SizeQuantityMap {
  if (!source || typeof source !== 'object') return {};

  const raw = source.size_breakdown;
  const result: SizeQuantityMap = {};

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [size, qty] of Object.entries(raw)) {
      const normalizedSize = normalizeSizeLabel(size);
      const numeric = toFiniteInteger(qty);
      if (normalizedSize && numeric > 0) {
        result[normalizedSize] = (result[normalizedSize] || 0) + numeric;
      }
    }
  }

  return result;
}

export function mergeSizeBreakdowns(target: SizeQuantityMap, source: SizeQuantityMap) {
  for (const [size, qty] of Object.entries(source)) {
    const normalizedSize = normalizeSizeLabel(size);
    const numeric = toFiniteInteger(qty);
    if (!normalizedSize || numeric <= 0) continue;
    target[normalizedSize] = (target[normalizedSize] || 0) + numeric;
  }

  return target;
}

export function sortSizeLabels(sizeLabels: string[]) {
  return [...sizeLabels].sort((left, right) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const leftIsNumber = Number.isFinite(leftNumber) && String(leftNumber) === left.trim();
    const rightIsNumber = Number.isFinite(rightNumber) && String(rightNumber) === right.trim();

    if (leftIsNumber && rightIsNumber) return leftNumber - rightNumber;
    if (leftIsNumber) return -1;
    if (rightIsNumber) return 1;
    return left.localeCompare(right, 'uk');
  });
}

export function buildSizeRows(
  plannedSizes: SizeQuantityMap,
  inputRows: Array<{ size: string; quantity: number; defect_quantity: number }>,
): OverlockSizeRow[] {
  const rows = inputRows.map((row) => {
    const size = normalizeSizeLabel(row.size);
    const plannedQty = toFiniteInteger(plannedSizes[size]);
    return {
      size,
      planned_qty: plannedQty,
      quantity: toFiniteInteger(row.quantity),
      defect_quantity: toFiniteInteger(row.defect_quantity),
    };
  });

  return rows.filter((row) => row.size);
}

export function sumSizeQuantities(rows: Array<{ quantity: number; defect_quantity: number }>) {
  return rows.reduce(
    (acc, row) => {
      acc.quantity += toFiniteInteger(row.quantity);
      acc.defect_quantity += toFiniteInteger(row.defect_quantity);
      return acc;
    },
    { quantity: 0, defect_quantity: 0 },
  );
}
