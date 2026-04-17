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
      .from('batch_tasks')
      .select('id, status, assigned_role, accepted_by_employee_id, completed_at')
      .eq('batch_id', parseInt(id, 10))
      .order('created_at', { ascending: true });

    if (error) return ApiResponse.handle(error, 'batches_id_tasks_get');
    return ApiResponse.success(data || []);
  } catch (error) {
    return ApiResponse.handle(error, 'batches_id_tasks_get');
  }
}