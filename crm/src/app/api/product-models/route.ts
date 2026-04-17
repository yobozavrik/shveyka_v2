import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const supabase = await createServerClient(true);
    let query = supabase
      .from('product_models')
      .select('id, keycrm_id, name, sku, category, description, thumbnail_url, source_payload, is_active')
      .order('name');

    if (source === 'keycrm') {
      query = query.contains('source_payload', { seed: true });
    }

    const { data, error } = await query;

    if (error) return ApiResponse.handle(error, 'product_models_get');
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'product_models_get');
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
      .from('product_models')
      .insert({
        keycrm_id: body.keycrm_id || null,
        name: body.name,
        sku: body.sku,
        category: body.category || null,
        description: body.description || null,
        thumbnail_url: body.thumbnail_url || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'product_models_post');

    // ЗАПИС В ЖУРНАЛ АУДИТУ
    if (auth) {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'CREATE',
        entityType: 'model',
        entityId: data.id.toString(),
        newData: data,
        request,
        auth: { id: auth.userId, username: auth.username }
      });
    }

    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'product_models_post');
  }
}
