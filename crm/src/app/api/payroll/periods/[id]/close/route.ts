import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = await createServerClient();

    // Check period exists and is open
    const { data: period, error: fetchError } = await supabase
      .from('payroll_periods')
      .select('status')
      .eq('id', parseInt(id))
      .single();

    if (fetchError || !period) return ApiResponse.error('Період не знайдено', ERROR_CODES.NOT_FOUND, 404);
    if (period.status === 'closed') return ApiResponse.error('Період вже закритий', ERROR_CODES.BAD_REQUEST, 400);

    const { data, error } = await supabase
      .from('payroll_periods')
      .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: auth.userId })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'payroll_period_close');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'payroll_period_close');
  }
}
