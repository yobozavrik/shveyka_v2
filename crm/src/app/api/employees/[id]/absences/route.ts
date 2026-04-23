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
      .from('employee_absences')
      .select('*')
      .eq('employee_id', empId)
      .order('start_date', { ascending: false });

    if (error) return ApiResponse.handle(error, 'employee_absences');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'employee_absences_get');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const empId = parseInt(id);

    // Only privileged roles can add absences for others
    if (!PRIVILEGED_ROLES.includes(auth.role) && auth.employeeId !== empId) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('employee_absences')
      .insert({
        employee_id: empId,
        type: body.type,
        start_date: body.start_date,
        end_date: body.end_date,
        notes: body.notes,
        status: body.status || 'approved'
      })
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'employee_absences');
    return ApiResponse.success(data, 201);
  } catch (error) {
    return ApiResponse.handle(error, 'employee_absences_post');
  }
}
