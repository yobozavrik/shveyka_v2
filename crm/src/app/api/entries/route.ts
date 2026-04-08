import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  await requireAuth();
  const supabase = await createServerClient(true);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'submitted';
  const limit = parseInt(searchParams.get('limit') || '100');
  const batchId = searchParams.get('batch_id');
  const employeeId = searchParams.get('employee_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  let query = supabase
    .from('operation_entries')
    .select(`
      id, quantity, size, status, entry_date, entry_time, notes, created_at,
      employee_id, operation_id, production_batch_id
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') query = query.eq('status', status);
  if (batchId) query = query.eq('production_batch_id', parseInt(batchId));
  if (employeeId) query = query.eq('employee_id', parseInt(employeeId));
  if (dateFrom) query = query.gte('entry_date', dateFrom);
  if (dateTo) query = query.lte('entry_date', dateTo);

  const { data, error } = await query;
  if (error) {
    console.error('Supabase error in /api/entries:', error);
    return NextResponse.json([]);
  }

  const rows = Array.isArray(data) ? data : [];
  const employeeIds = [...new Set(rows.map((row: any) => row.employee_id).filter(Boolean))];
  const operationIds = [...new Set(rows.map((row: any) => row.operation_id).filter(Boolean))];
  const batchIds = [...new Set(rows.map((row: any) => row.production_batch_id).filter(Boolean))];

  const [employeesRes, operationsRes, batchesRes] = await Promise.all([
    employeeIds.length > 0
      ? supabase.from('employees').select('id, full_name, position').in('id', employeeIds)
      : Promise.resolve({ data: [], error: null }),
    operationIds.length > 0
      ? supabase.from('operations').select('id, name, code, base_rate, operation_type').in('id', operationIds)
      : Promise.resolve({ data: [], error: null }),
    batchIds.length > 0
      ? supabase.from('production_batches').select('id, batch_number').in('id', batchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const employeeMap = new Map<number, any>();
  const operationMap = new Map<number, any>();
  const batchMap = new Map<number, any>();

  if (!employeesRes.error && Array.isArray(employeesRes.data)) {
    for (const employee of employeesRes.data) employeeMap.set(Number((employee as any).id), employee);
  }
  if (!operationsRes.error && Array.isArray(operationsRes.data)) {
    for (const operation of operationsRes.data) operationMap.set(Number((operation as any).id), operation);
  }
  if (!batchesRes.error && Array.isArray(batchesRes.data)) {
    for (const batch of batchesRes.data) batchMap.set(Number((batch as any).id), batch);
  }

  return NextResponse.json(
    rows.map((row: any) => ({
      ...row,
      employees: row.employee_id ? employeeMap.get(Number(row.employee_id)) || null : null,
      operations: row.operation_id ? operationMap.get(Number(row.operation_id)) || null : null,
      production_batches: row.production_batch_id ? batchMap.get(Number(row.production_batch_id)) || null : null,
    }))
  );
}
