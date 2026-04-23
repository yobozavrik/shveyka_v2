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
      .from('keycrm_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return ApiResponse.handle(error, 'keycrm_sync_log_get');
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'keycrm_sync_log_get');
  }
}
