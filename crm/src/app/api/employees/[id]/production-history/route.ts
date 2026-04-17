import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

const PRIVILEGED_ROLES = ['admin', 'manager', 'hr', 'production_head'];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const empId = parseInt(id, 10);

    // IDOR Protection
    if (!PRIVILEGED_ROLES.includes(auth.role) && auth.employeeId !== empId) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const supabase = await createServerClient(true);

    // Загружаем записи сотрудника
    const { data: entries, error } = await supabase
      .from('task_entries')
      .select(`
        id, quantity, status, recorded_at, data,
        batch_id,
        operation_id,
        stage_id
      `)
      .eq('employee_id', empId)
      .eq('status', 'approved')
      .order('recorded_at', { ascending: false });

    if (error) return ApiResponse.handle(error, 'employee_production_history');

    // Обогащаем данными о партии и операции
    const batchIds = [...new Set(entries?.map(e => e.batch_id).filter(Boolean))];
    const opIds = [...new Set(entries?.map(e => e.operation_id).filter(Boolean))];

    const [batchesRes, opsRes] = await Promise.all([
      batchIds.length > 0 
        ? supabase.from('production_batches').select('id, batch_number, production_orders(order_number)').in('id', batchIds)
        : Promise.resolve({ data: [] }),
      opIds.length > 0
        ? supabase.from('stage_operations').select('id, name, code').in('id', opIds)
        : Promise.resolve({ data: [] })
    ]);

    const batchMap = new Map(batchesRes.data?.map((b: any) => [b.id, b]) || []);
    const opMap = new Map(opsRes.data?.map((o: any) => [o.id, o]) || []);

    const history = entries?.map(entry => {
      const batch = batchMap.get(entry.batch_id);
      const op = opMap.get(entry.operation_id);
      
      return {
        id: entry.id,
        date: entry.recorded_at,
        quantity: entry.quantity,
        sizes: entry.data?.sizes || {},
        batch_number: batch?.batch_number || '—',
        order_number: batch?.production_orders?.order_number || '—',
        operation_name: op?.name || op?.code || '—',
      };
    });

    return ApiResponse.success(history || []);
  } catch (error) {
    return ApiResponse.handle(error, 'employee_production_history');
  }
}