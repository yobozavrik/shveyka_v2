import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const supabase = await createServerClient(true);
    let query = supabase
      .from('vacancies')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return ApiResponse.handle(error, 'vacancies_list');

    return ApiResponse.success(data);
  } catch (e: any) {
    return ApiResponse.handle(e, 'vacancies_list');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const vacancyData = {
      title: body.title,
      description: body.description,
      requirements: body.requirements || {},
      status: body.status || 'open',
    };

    const { data, error } = await supabase
      .from('vacancies')
      .insert([vacancyData])
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'vacancies_post');

    // Record audit log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'CREATE',
        entityType: 'vacancy',
        entityId: data.id.toString(),
        newData: data,
        request,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'vacancies_post');
  }
}
