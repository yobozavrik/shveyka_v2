import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data: vacancy, error } = await supabase
      .from('vacancies')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error) return ApiResponse.handle(error, 'vacancies_get');
    if (!vacancy) return ApiResponse.error('Не знайдено', ERROR_CODES.NOT_FOUND, 404);

    return ApiResponse.success(vacancy);
  } catch (e: any) {
    return ApiResponse.handle(e, 'vacancies_get');
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = await createServerClient(true);

    const { data: oldData } = await supabase.from('vacancies').select('*').eq('id', parseInt(id)).single();

    const allowed = ['title', 'description', 'requirements', 'status'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const { data, error } = await supabase
      .from('vacancies')
      .update(update)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'vacancies_patch');

    // Record audit log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'UPDATE',
        entityType: 'vacancy',
        entityId: id,
        oldData,
        newData: data,
        request: req,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return ApiResponse.success(data);
  } catch (e: any) {
    return ApiResponse.handle(e, 'vacancies_patch');
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || auth.role !== 'admin') {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data: oldData } = await supabase.from('vacancies').select('*').eq('id', parseInt(id)).single();

    const { error } = await supabase
      .from('vacancies')
      .delete()
      .eq('id', parseInt(id));

    if (error) return ApiResponse.handle(error, 'vacancies_delete');

    // Record audit log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'DELETE',
        entityType: 'vacancy',
        entityId: id,
        oldData,
        newData: null,
        request: req,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return ApiResponse.success({ success: true });
  } catch (e: any) {
    return ApiResponse.handle(e, 'vacancies_delete');
  }
}
