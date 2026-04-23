import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

const ALLOWED_ROLES = ['admin', 'manager', 'hr', 'production_head'];

const FALLBACK_POSITIONS = [
  { id: -1, name: 'Розкрійник', is_active: true, sort_order: 10 },
  { id: -2, name: 'Швея', is_active: true, sort_order: 20 },
  { id: -3, name: 'Оверлочниця', is_active: true, sort_order: 30 },
  { id: -4, name: 'Пакувальниця', is_active: true, sort_order: 40 },
  { id: -5, name: 'Контролер якості', is_active: true, sort_order: 50 },
  { id: -6, name: 'Майстер', is_active: true, sort_order: 60 },
  { id: -7, name: 'Начальник виробництва', is_active: true, sort_order: 70 },
  { id: -8, name: 'Адміністратор', is_active: true, sort_order: 80 },
  { id: -9, name: 'HR', is_active: true, sort_order: 90 },
];

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const shveyka = await createServerClient(true);
    const { data, error } = await shveyka
      .from('positions')
      .select('id, name, is_active, sort_order, default_role, created_at, updated_at')
      .order('sort_order')
      .order('name');

    if (error) {
      if (error.message.includes('does not exist')) return ApiResponse.success(FALLBACK_POSITIONS);
      return ApiResponse.handle(error, 'positions_get');
    }

    return ApiResponse.success(data || []);
  } catch (error) {
    return ApiResponse.handle(error, 'positions_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = normalizeString(body.name);
    const sortOrder = body.sort_order === undefined || body.sort_order === null || body.sort_order === '' ? 0 : Number(body.sort_order);
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : true;

    if (!name) return ApiResponse.error('Вкажіть назву посади', ERROR_CODES.BAD_REQUEST, 400);

    const shveyka = await createServerClient(true);
    const { data, error } = await shveyka
      .from('positions')
      .insert({
        name,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        is_active: isActive,
      })
      .select('id, name, is_active, sort_order, created_at, updated_at')
      .single();

    if (error) {
      if (error.message.includes('does not exist')) {
        return ApiResponse.error('Довідник посад ще не створений у базі. Застосуйте міграцію `20260406_positions_directory_shveyka.sql`.', ERROR_CODES.INTERNAL_ERROR, 503);
      }
      return ApiResponse.handle(error, 'positions_post');
    }

    return ApiResponse.success(data, 201);
  } catch (error) {
    return ApiResponse.handle(error, 'positions_post');
  }
}
