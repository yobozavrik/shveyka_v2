import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
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
      .from('task_entries')
      .select(`
        id, quantity, status, recorded_at, notes, created_at,
        employee_id, operation_id, batch_id, data
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') query = query.eq('status', status);
    if (batchId) query = query.eq('batch_id', parseInt(batchId));
    if (employeeId) query = query.eq('employee_id', parseInt(employeeId));
    if (dateFrom) query = query.gte('recorded_at', dateFrom);
    if (dateTo) query = query.lte('recorded_at', dateTo);

    const { data, error } = await query;
    if (error) return ApiResponse.handle(error, 'entries_list');

    const rows = Array.isArray(data) ? data : [];
    const employeeIds = [...new Set(rows.map((row: any) => row.employee_id).filter(Boolean))];
    const operationIds = [...new Set(rows.map((row: any) => row.operation_id).filter(Boolean))];
    const batchIds = [...new Set(rows.map((row: any) => row.batch_id).filter(Boolean))];

    const [employeesRes, operationsRes, batchesRes] = await Promise.all([
      employeeIds.length > 0
        ? supabase.from('employees').select('id, full_name, position').in('id', employeeIds)
        : Promise.resolve({ data: [], error: null }),
      operationIds.length > 0
        ? supabase.from('stage_operations').select('id, name, code').in('id', operationIds)
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

    const result = rows.map((row: any) => ({
      ...row,
      size: row.data?.size || '',
      entry_date: row.recorded_at ? row.recorded_at.split('T')[0] : null,
      entry_time: row.recorded_at ? row.recorded_at.split('T')[1]?.split('.')[0] : null,
      employees: row.employee_id ? employeeMap.get(Number(row.employee_id)) || null : null,
      operations: row.operation_id ? operationMap.get(Number(row.operation_id)) || null : null,
      production_batches: row.batch_id ? batchMap.get(Number(row.batch_id)) || null : null,
    }));

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.handle(error, 'entries_list');
  }
}
