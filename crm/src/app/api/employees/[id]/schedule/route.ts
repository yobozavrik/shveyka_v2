import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };
const PRIVILEGED_ROLES = ['admin', 'manager', 'hr'];

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const empId = parseInt(id);

    // IDOR Protection
    if (!PRIVILEGED_ROLES.includes(auth.role) && auth.employeeId !== empId) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('employee_id', empId)
      .order('day_of_week');

    if (error) return ApiResponse.handle(error, 'employee_schedule');
    return ApiResponse.success(data || []);
  } catch (error) {
    return ApiResponse.handle(error, 'employee_schedule_get');
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    if (!PRIVILEGED_ROLES.includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const { schedule } = await req.json();
    const supabase = await createServerClient(true);

    const rows = (schedule as Array<{ day_of_week: number; start_time: string; end_time: string; is_working: boolean }>).map(s => ({
      employee_id: parseInt(id),
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_working: s.is_working,
    }));

    const { data, error } = await supabase
      .from('work_schedules')
      .upsert(rows, { onConflict: 'employee_id,day_of_week' })
      .select();

    if (error) return ApiResponse.handle(error, 'employee_schedule');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'employee_schedule_put');
  }
}
