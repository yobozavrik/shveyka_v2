import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'master', 'quality'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = await createServerClient();

    const allowed = ['quantity', 'severity', 'description', 'photo_url', 'operation_id', 'employee_id'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const { data, error } = await supabase
      .from('defects')
      .update(update)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'defects_update');
    return ApiResponse.success(data);
  } catch (error: any) {
    return ApiResponse.handle(error, 'defects_update');
  }
}
