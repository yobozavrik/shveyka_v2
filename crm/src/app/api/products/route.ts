import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('product_models')
      .select('id, sku, name, is_active')
      .order('name');

    if (error) return ApiResponse.handle(error, 'products_get');
    return ApiResponse.success(data || []);
  } catch (error) {
    return ApiResponse.handle(error, 'products_get');
  }
}
