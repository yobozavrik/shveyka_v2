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
      .from('payroll_periods')
      .select('*')
      .order('period_start', { ascending: false });

    if (error) return ApiResponse.handle(error, 'payroll_periods_get');
    return ApiResponse.success(data || []);
  } catch (error) {
    return ApiResponse.handle(error, 'payroll_periods_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('payroll_periods')
      .insert({
        period_start: body.period_start || body.date_from,
        period_end: body.period_end || body.date_to,
        is_closed: body.is_closed || false,
        notes: body.notes || ''
      })
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'payroll_periods_post');
    return ApiResponse.success(data, 201);
  } catch (error) {
    return ApiResponse.handle(error, 'payroll_periods_post');
  }
}
