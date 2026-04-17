import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = await createServerClient();

    const update: Record<string, unknown> = {};
    if (body.absence_type !== undefined) update.absence_type = body.absence_type;
    if (body.date_from !== undefined) update.date_from = body.date_from;
    if (body.date_to !== undefined) update.date_to = body.date_to;
    if (body.reason !== undefined) update.reason = body.reason;

    const { data, error } = await supabase
      .from('employee_absences')
      .update(update)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'absences_put');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'absences_put');
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('employee_absences')
      .delete()
      .eq('id', parseInt(id));

    if (error) return ApiResponse.handle(error, 'absences_delete');
    return ApiResponse.success({ success: true });
  } catch (error) {
    return ApiResponse.handle(error, 'absences_delete');
  }
}
