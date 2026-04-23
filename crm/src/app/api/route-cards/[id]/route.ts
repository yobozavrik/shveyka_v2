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
      .from('route_cards')
      .select('*, product_models(id, name, sku, source_payload, is_active)')
      .eq('id', parseInt(id))
      .single();

    if (error) return ApiResponse.handle(error, 'route_cards_id_get');
    if (!data) return ApiResponse.error('Не знайдено', ERROR_CODES.NOT_FOUND, 404);

    return ApiResponse.success(data);
  } catch (error: any) {
    return ApiResponse.handle(error, 'route_cards_id_get');
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { error } = await supabase.from('route_cards').delete().eq('id', parseInt(id));

    if (error) return ApiResponse.handle(error, 'route_cards_id_delete');
    return ApiResponse.success({ success: true });
  } catch (error: any) {
    return ApiResponse.handle(error, 'route_cards_id_delete');
  }
}
