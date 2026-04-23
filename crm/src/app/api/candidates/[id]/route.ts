import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { recordAuditLog } from '@/lib/audit';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', parseInt(id, 10))
      .single();

    if (error) return ApiResponse.handle(error, 'candidates_get');
    return ApiResponse.success(data);
  } catch (e: any) {
    return ApiResponse.handle(e, 'candidates_get');
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data: oldData } = await supabase.from('candidates').select('*').eq('id', id).single();

    const { data, error } = await supabase
      .from('candidates')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parseInt(id, 10))
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'candidates_patch');

    try {
      await recordAuditLog({
        action: 'UPDATE',
        entityType: 'candidate',
        entityId: id,
        oldData,
        newData: data,
        request,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return ApiResponse.success(data);
  } catch (e: any) {
    return ApiResponse.handle(e, 'candidates_patch');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data: oldData } = await supabase.from('candidates').select('*').eq('id', id).single();

    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', parseInt(id, 10));

    if (error) return ApiResponse.handle(error, 'candidates_delete');

    try {
      await recordAuditLog({
        action: 'DELETE',
        entityType: 'candidate',
        entityId: id,
        oldData,
        request,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return ApiResponse.success({ success: true });
  } catch (e: any) {
    return ApiResponse.handle(e, 'candidates_delete');
  }
}
