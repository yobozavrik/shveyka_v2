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
      .from('employee_attendance')
      .select(`
        *,
        employees (
          full_name,
          position
        )
      `)
      .order('check_in', { ascending: false });

    if (error) return ApiResponse.handle(error, 'attendance');

    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'attendance_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const body = await request.json();
    const { employee_id, action, source } = body;

    if (!employee_id) {
      return ApiResponse.error('Не вказано employee_id', ERROR_CODES.BAD_REQUEST, 400);
    }

    const supabase = await createServerClient(true);

    if (action === 'check_in') {
      const { data: existing } = await supabase
        .from('employee_attendance')
        .select('id')
        .eq('employee_id', employee_id)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        return ApiResponse.error('Співробітник вже відмітив вхід', ERROR_CODES.CONFLICT, 409, { id: existing.id });
      }

      const { data, error } = await supabase
        .from('employee_attendance')
        .insert({
          employee_id,
          check_in: new Date().toISOString(),
          status: 'active',
          source: source || 'crm',
        })
        .select(`
          *,
          employees (full_name, position)
        `)
        .single();

      if (error) return ApiResponse.handle(error, 'attendance');
      return ApiResponse.success(data, 201);
    }

    if (action === 'check_out') {
      const { data: active } = await supabase
        .from('employee_attendance')
        .select('id')
        .eq('employee_id', employee_id)
        .eq('status', 'active')
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) {
        return ApiResponse.error('Немає активного запису входу', ERROR_CODES.NOT_FOUND, 404);
      }

      const { data, error } = await supabase
        .from('employee_attendance')
        .update({
          check_out: new Date().toISOString(),
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', active.id)
        .select(`
          *,
          employees (full_name, position)
        `)
        .single();

      if (error) return ApiResponse.handle(error, 'attendance');
      return ApiResponse.success(data);
    }

    return ApiResponse.error('Невідома дія. Використовуйте check_in або check_out', ERROR_CODES.BAD_REQUEST, 400);
  } catch (e: any) {
    return ApiResponse.handle(e, 'attendance_post');
  }
}
