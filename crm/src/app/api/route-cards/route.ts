import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    await requireAuth();
    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('route_cards')
      .select(`
        id, version, is_active, description, created_at, weight_grams,
        product_models(id, name, sku, source_payload, is_active)
      `)
      .order('created_at', { ascending: false });

    if (error) return ApiResponse.handle(error, 'route_cards_get');
    
    return ApiResponse.success(Array.isArray(data) ? data : []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'route_cards_get');
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(['admin', 'manager', 'technologist']);
    const body = await request.json();
    const supabase = await createServerClient(true);

    if (!body.product_model_id) {
      return ApiResponse.error('product_model_id is required', ERROR_CODES.BAD_REQUEST, 400);
    }

    const { data: model, error: modelErr } = await supabase
      .from('product_models')
      .select('id, source_payload, name, sku')
      .eq('id', Number(body.product_model_id))
      .single();

    if (modelErr) return ApiResponse.handle(modelErr, 'route_cards_post');
    if (!model) return ApiResponse.error('Model not found', ERROR_CODES.NOT_FOUND, 404);

    const sourcePayload = model.source_payload as { seed?: boolean } | null;
    if (!sourcePayload || sourcePayload.seed !== true) {
      return ApiResponse.error('Route cards can be created only for seed models', ERROR_CODES.BAD_REQUEST, 400);
    }

    // 1. Create route card
    const { data: rc, error: rcErr } = await supabase
      .from('route_cards')
      .insert({
        product_model_id: Number(body.product_model_id),
        version: body.version || 1,
        is_active: body.is_active !== false,
        description: body.description || null,
        weight_grams: body.weight_grams || 0,
      })
      .select()
      .single();

    if (rcErr) return ApiResponse.handle(rcErr, 'route_cards_post');

    return ApiResponse.success(rc, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'route_cards_post');
  }
}
