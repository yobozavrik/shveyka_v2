import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = await createServerClient(true);

    const allowed = ['code', 'name', 'category', 'unit', 'current_stock', 'min_stock', 'price_per_unit', 'is_active'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const { data, error } = await supabase
      .from('materials')
      .update(update)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'warehouse_materials_put');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'warehouse_materials_put');
  }
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const supabase = await createServerClient();

    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('material_id', parseInt(id))
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return ApiResponse.handle(error, 'warehouse_materials_get');

    return ApiResponse.success(movements || []);
  } catch (error) {
    return ApiResponse.handle(error, 'warehouse_materials_get');
  }
}
