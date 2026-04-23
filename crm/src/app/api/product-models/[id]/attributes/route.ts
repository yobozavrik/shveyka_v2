import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const modelId = parseInt(id, 10);
    if (Number.isNaN(modelId)) {
      return ApiResponse.error('Invalid model id', ERROR_CODES.BAD_REQUEST, 400);
    }

    const supabase = await createServerClient(true);
    const [{ data: definitions, error: defError }, { data: values, error: valueError }] = await Promise.all([
      supabase
        .from('catalog_attribute_definitions')
        .select('*')
        .eq('scope', 'model')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true }),
      supabase
        .from('catalog_attribute_values')
        .select('*')
        .eq('product_model_id', modelId),
    ]);

    if (defError) return ApiResponse.handle(defError, 'product_model_attributes_get');
    if (valueError) return ApiResponse.handle(valueError, 'product_model_attributes_get');

    const byDefinitionId = new Map((values || []).map(value => [value.attribute_definition_id, value]));

    return ApiResponse.success(
      (definitions || []).map(definition => ({
        definition,
        value: byDefinitionId.get(definition.id) || null,
      })),
    );
  } catch (e: any) {
    return ApiResponse.handle(e, 'product_model_attributes_get');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const modelId = parseInt(id, 10);
    if (Number.isNaN(modelId)) {
      return ApiResponse.error('Invalid model id', ERROR_CODES.BAD_REQUEST, 400);
    }

    const body = await request.json();
    const items = Array.isArray(body.attributes) ? body.attributes : [];
    if (items.length === 0) {
      return ApiResponse.error('attributes are required', ERROR_CODES.BAD_REQUEST, 400);
    }

    const supabase = await createServerClient(true);
    const rows = items.map((item: Record<string, unknown>) => ({
      product_model_id: modelId,
      attribute_definition_id: item.attribute_definition_id,
      value_text: item.value_text ?? null,
      value_number: item.value_number ?? null,
      value_boolean: item.value_boolean ?? null,
      value_date: item.value_date ?? null,
      value_json: item.value_json ?? null,
    }));

    const { data, error } = await supabase
      .from('catalog_attribute_values')
      .upsert(rows, { onConflict: 'product_model_id,attribute_definition_id' })
      .select();

    if (error) return ApiResponse.handle(error, 'product_model_attributes_post');

    return ApiResponse.success(data, 200);
  } catch (e: any) {
    return ApiResponse.handle(e, 'product_model_attributes_post');
  }
}
