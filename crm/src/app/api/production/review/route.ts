import { createServerClient } from '@/lib/supabase/server';
import { getRole } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    const role = await getRole();
    if (!['admin', 'manager', 'master'].includes(role || '')) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('task_entries')
      .select(`
        *,
        employees!task_entries_employee_id_fkey(id, full_name),
        production_batches!task_entries_batch_id_fkey(id, batch_number),
        stage_operations!task_entries_operation_id_fkey(id, code)
      `)
      .eq('status', 'submitted')
      .order('recorded_at', { ascending: false });

    if (error) return ApiResponse.handle(error, 'production_review_get');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'production_review_get');
  }
}

export async function PATCH(request: Request) {
  try {
    const role = await getRole();
    if (!['admin', 'master'].includes(role || '')) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id, status } = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('task_entries')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'production_review_patch');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'production_review_patch');
  }
}
