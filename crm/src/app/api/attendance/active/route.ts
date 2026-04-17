import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient();

    // Get employees with 'active' status in employee_attendance
    const { data, error } = await supabase
      .from('employee_attendance')
      .select('employee_id')
      .eq('status', 'active');

    if (error) {
      return ApiResponse.handle(error, 'attendance_active');
    }

    const activeIds = (data || []).map(row => row.employee_id);
    return ApiResponse.success(activeIds);
  } catch (e: any) {
    return ApiResponse.handle(e, 'attendance_active');
  }
}
