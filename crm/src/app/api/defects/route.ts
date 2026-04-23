import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const supabase = await createServerClient();

    let query = supabase
      .from('defects')
      .select('*')
      .order('created_at', { ascending: false });

    const batchId = searchParams.get('batch_id');
    const employeeId = searchParams.get('employee_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (batchId) query = query.eq('production_batch_id', parseInt(batchId));
    if (employeeId) query = query.eq('employee_id', parseInt(employeeId));
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) return ApiResponse.handle(error, 'defects_get');
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'defects_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'master', 'quality'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('defects')
      .insert({
        production_batch_id: body.production_batch_id,
        operation_id: body.operation_id || null,
        employee_id: body.employee_id || null,
        quantity: body.quantity || 1,
        defect_type: body.defect_type || 'minor',
        defect_reason: body.defect_reason || body.description || '',
        decision: body.decision || 'rework',
        description: body.description || '',
        detected_by: auth.userId,
      })
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'defects_post');
    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'defects_post');
  }
}
