import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('model_id');
    const quantity = parseInt(searchParams.get('quantity') || '1');

    if (!modelId) return ApiResponse.error('model_id обовʼязковий', ERROR_CODES.BAD_REQUEST, 400);

    const supabase = await createServerClient(true);

    // Get norms for model
    const { data: norms, error } = await supabase
      .from('material_norms')
      .select('*, materials(id, name, code, unit, current_stock)')
      .eq('product_model_id', parseInt(modelId));

    if (error) return ApiResponse.handle(error, 'warehouse_norms_check');

    if (!norms || norms.length === 0) {
      return ApiResponse.success({ sufficient: true, message: 'Норми не задані', items: [] });
    }

    const items = norms.map((n: { quantity_per_unit: number; materials: { id: number; name: string; current_stock: number; unit: string } }) => {
      const needed = n.quantity_per_unit * quantity;
      const available = n.materials?.current_stock || 0;
      return {
        material: n.materials,
        needed,
        available,
        deficit: Math.max(0, needed - available),
        sufficient: available >= needed,
      };
    });

    const allSufficient = items.every((i: { sufficient: boolean }) => i.sufficient);

    return ApiResponse.success({
      sufficient: allSufficient,
      items,
    });
  } catch (error) {
    return ApiResponse.handle(error, 'warehouse_norms_check');
  }
}
