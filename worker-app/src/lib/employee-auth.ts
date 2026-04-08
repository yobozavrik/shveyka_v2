export interface EmployeeAuthRow {
  id: number;
  full_name: string;
  employee_number: string | null;
  status: string | null;
}

function statusRank(status: string | null | undefined): number {
  const normalized = (status || 'active').toLowerCase();
  if (normalized === 'active') return 0;
  if (normalized === 'pending') return 1;
  return 2;
}

export function pickBestEmployee(rows: EmployeeAuthRow[] | null | undefined): EmployeeAuthRow | null {
  if (!rows || rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => {
    const rankDiff = statusRank(left.status) - statusRank(right.status);
    if (rankDiff !== 0) return rankDiff;
    return left.id - right.id;
  })[0];
}
