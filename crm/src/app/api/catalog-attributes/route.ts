import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

function normalizeKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '_')
    .replace(/^_+|_+$/g, '');
}

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    const supabase = await createServerClient(true);
    let query = supabase
      .from('catalog_attribute_definitions')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (scope) query = query.eq('scope', scope);

    const { data, error } = await query;
    if (error) return ApiResponse.handle(error, 'catalog_attributes_get');

    return ApiResponse.success(data || []);
  } catch (error) {
    return ApiResponse.handle(error, 'catalog_attributes_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const key = normalizeKey(body.key || body.label || '');

    if (!key || !body.label) return ApiResponse.error('key and label are required', ERROR_CODES.BAD_REQUEST, 400);

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('catalog_attribute_definitions')
      .insert({
        key,
        label: body.label,
        description: body.description || null,
        value_type: body.value_type || 'text',
        scope: body.scope || 'model',
        source: body.source || 'manual',
        is_required: body.is_required ?? false,
        is_active: body.is_active ?? true,
        sort_order: body.sort_order ?? 0,
        config: body.config || {},
      })
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'catalog_attributes_post');

    return ApiResponse.success(data, 201);
  } catch (error) {
    return ApiResponse.handle(error, 'catalog_attributes_post');
  }
}
