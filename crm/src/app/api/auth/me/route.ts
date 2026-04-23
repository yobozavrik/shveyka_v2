import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, role, employee_id, is_active, employees(id, full_name, position)')
      .eq('id', auth.userId)
      .single();

    if (error) return ApiResponse.handle(error, 'auth_me');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'auth_me');
  }
}
