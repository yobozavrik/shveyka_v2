import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('task_entries')
      .select(`
        id, quantity, status, recorded_at, data,
        employees!task_entries_employee_id_fkey(id, full_name, position),
        stage_operations!task_entries_operation_id_fkey(id, code, name)
      `)
      .eq('batch_id', parseInt(id, 10))
      .order('recorded_at', { ascending: false });

    if (error) return ApiResponse.handle(error, 'batches_id_entries');
    return ApiResponse.success(data || []);
  } catch (error) {
    return ApiResponse.handle(error, 'batches_id_entries');
  }
}
