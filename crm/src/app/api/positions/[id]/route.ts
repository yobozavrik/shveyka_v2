import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

const ALLOWED_ROLES = ['admin', 'manager', 'hr', 'production_head'];
type Params = { params: Promise<{ id: string }> };

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const positionId = Number(id);
    if (!Number.isFinite(positionId)) return ApiResponse.error('Некоректний ідентифікатор', ERROR_CODES.BAD_REQUEST, 400);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = normalizeString(body.name);
    const shveyka = await createServerClient(true);

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = name;
    if (body.sort_order !== undefined) {
      updates.sort_order = body.sort_order === null || body.sort_order === '' ? 0 : Number(body.sort_order);
    }
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;

    if ('name' in updates && !updates.name) return ApiResponse.error('Вкажіть назву посади', ERROR_CODES.BAD_REQUEST, 400);

    const { data, error } = await shveyka
      .from('positions')
      .update(updates)
      .eq('id', positionId)
      .select('id, name, is_active, sort_order, created_at, updated_at')
      .single();

    if (error) return ApiResponse.handle(error, 'positions_id_patch');

    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'positions_id_patch');
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const positionId = Number(id);
    if (!Number.isFinite(positionId)) return ApiResponse.error('Некоректний ідентифікатор', ERROR_CODES.BAD_REQUEST, 400);

    const shveyka = await createServerClient(true);
    const { data, error } = await shveyka
      .from('positions')
      .update({ is_active: false })
      .eq('id', positionId)
      .select('id, name, is_active, sort_order, created_at, updated_at')
      .single();

    if (error) return ApiResponse.handle(error, 'positions_id_delete');

    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'positions_id_delete');
  }
}
