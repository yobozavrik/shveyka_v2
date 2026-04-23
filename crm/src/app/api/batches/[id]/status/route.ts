import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'master'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const { status } = await req.json();
    const validStatuses = ['created', 'cutting', 'sewing', 'overlock', 'straight_stitch', 'coverlock', 'packaging', 'ready', 'shipped', 'closed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return ApiResponse.error('Невірний статус', ERROR_CODES.BAD_REQUEST, 400);
    }

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('production_batches')
      .update({ status })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'batches_id_status_patch');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'batches_id_status_patch');
  }
}
