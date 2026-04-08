import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');
  const supabase = await createServerClient(true);

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  const dateFromStr = dateFrom.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('operation_entries')
    .select(`
      quantity,
      employees(department)
    `)
    .eq('status', 'confirmed')
    .gte('entry_date', dateFromStr);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const deptMap: Record<string, { confirmed_units: number; entries_count: number }> = {};
  (data || []).forEach((e: any) => {
    const dept = e.employees?.department || 'Інше';
    if (!deptMap[dept]) deptMap[dept] = { confirmed_units: 0, entries_count: 0 };
    deptMap[dept].confirmed_units += e.quantity;
    deptMap[dept].entries_count += 1;
  });

  const result = Object.entries(deptMap).map(([name, vals]) => ({
    name,
    ...vals
  })).sort((a, b) => b.confirmed_units - a.confirmed_units);

  return NextResponse.json(result);
}
