import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const supabase = await createServerClient(true);

    let query = supabase
      .from('material_norms')
      .select('*, items!material_id(id, name, sku, unit), product_models(id, name, sku)')
      .order('product_model_id');

    const modelId = searchParams.get('model_id');
    if (modelId) query = query.eq('product_model_id', parseInt(modelId));

    const { data, error } = await query;
    if (error) return ApiResponse.handle(error, 'warehouse_norms_get');
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_norms_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    if (!body.product_model_id || !body.material_id || !body.quantity_per_unit) {
      return ApiResponse.error('Обовʼязкові поля: product_model_id, material_id, quantity_per_unit', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('material_norms')
      .upsert(
        {
          product_model_id: body.product_model_id,
          material_id: body.material_id,
          quantity_per_unit: body.quantity_per_unit,
        },
        { onConflict: 'product_model_id,material_id' }
      )
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'warehouse_norms_post');
    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_norms_post');
  }
}
