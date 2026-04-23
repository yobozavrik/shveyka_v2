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
      .from('operations')
      .select('*')
      .order('operation_type')
      .order('name');

    if (error) return ApiResponse.handle(error, 'operations_get');
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'operations_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('operations')
      .insert({
        code: body.code,
        name: body.name,
        operation_type: body.operation_type || 'sewing',
        base_rate: body.base_rate,
        time_norm_minutes: body.time_norm_minutes || null,
        complexity_coefficient: body.complexity_coefficient || 1.0,
        unit: body.unit || 'pcs',
        description: body.description || null,
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'operations_post');
    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'operations_post');
  }
}
