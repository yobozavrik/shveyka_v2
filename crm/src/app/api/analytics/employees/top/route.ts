import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');
  const limit = parseInt(searchParams.get('limit') || '10');
  
  const supabase = await createServerClient(true);

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  const dateFromStr = dateFrom.toISOString().split('T')[0];

  // Join operation_entries with employees
  const { data, error } = await supabase
    .from('operation_entries')
    .select(`
      quantity,
      employee_id,
      employees(id, full_name, avatar_url, department)
    `)
    .eq('status', 'confirmed')
    .gte('entry_date', dateFromStr);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by employee
  const workerMap: Record<number, any> = {};
  (data || []).forEach((e: any) => {
    if (!e.employee_id || !e.employees) return;
    const id = e.employee_id;
    if (!workerMap[id]) {
      workerMap[id] = {
        id,
        full_name: e.employees.full_name,
        department: e.employees.department,
        avatar_url: e.employees.avatar_url,
        confirmed_units: 0,
        entries_count: 0
      };
    }
    workerMap[id].confirmed_units += e.quantity;
    workerMap[id].entries_count += 1;
  });

  const result = Object.values(workerMap)
    .sort((a: any, b: any) => b.confirmed_units - a.confirmed_units)
    .slice(0, limit);

  return NextResponse.json(result);
}
