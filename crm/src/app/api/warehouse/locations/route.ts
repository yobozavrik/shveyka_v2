import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient(true);
    const { searchParams } = new URL(request.url);
    const locationType = searchParams.get('type');

    let query = supabase
      .from('locations')
      .select('id, parent_id, name, type')
      .order('name');

    if (locationType) {
      query = query.eq('type', locationType);
    }

    const { data, error } = await query;
    if (error) return ApiResponse.handle(error, 'warehouse_locations_get');
    
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_locations_get');
  }
}
