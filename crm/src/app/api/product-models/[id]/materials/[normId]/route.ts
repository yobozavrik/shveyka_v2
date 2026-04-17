import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string; normId: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { normId } = await params;
    const body = await req.json();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('material_norms')
      .update({
        quantity_per_unit: body.quantity_per_unit,
        item_type: body.item_type || null,
        unit_of_measure: body.unit_of_measure || null,
        notes: body.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(normId))
      .select('*, items (id, name, sku, unit, price_per_unit)')
      .single();

    if (error) return ApiResponse.handle(error, 'product_model_material_norm_update');
    return ApiResponse.success(data);
  } catch (e: any) {
    return ApiResponse.handle(e, 'product_model_material_norm_update');
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { normId } = await params;
    const supabase = await createServerClient();

    // Soft delete
    const { error } = await supabase
      .from('material_norms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', parseInt(normId));

    if (error) return ApiResponse.handle(error, 'product_model_material_norm_delete');
    return ApiResponse.success({ success: true });
  } catch (e: any) {
    return ApiResponse.handle(e, 'product_model_material_norm_delete');
  }
}
