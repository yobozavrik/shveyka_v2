import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = await createServerClient(true);

    const allowed = ['name', 'sku', 'description', 'sizes', 'is_active', 'thumbnail_url'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const modelId = parseInt(id);
    const { data: oldData } = await supabase.from('product_models').select('*').eq('id', modelId).single();

    const { data, error } = await supabase
      .from('product_models')
      .update(update)
      .eq('id', modelId)
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'product_model_update');

    // ЗАПИС В ЖУРНАЛ АУДИТУ
    if (auth) {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'UPDATE',
        entityType: 'model',
        entityId: id,
        oldData,
        newData: data,
        request: req,
        auth: { id: auth.userId, username: auth.username }
      });
    }

    return ApiResponse.success(data);
  } catch (e: any) {
    return ApiResponse.handle(e, 'product_model_update');
  }
}
