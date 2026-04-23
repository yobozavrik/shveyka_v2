import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };
const ALLOWED_ROLES = ['admin', 'manager', 'master'];

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) {
      return ApiResponse.error('Invalid order id', ERROR_CODES.BAD_REQUEST, 400);
    }

    const body = await request.json().catch(() => ({}));
    const modelName = typeof body.model_name === 'string' ? body.model_name.trim() : '';
    const modelSku = typeof body.model_sku === 'string' ? body.model_sku.trim() : null;
    const quantity = Number(body.quantity);
    const size = typeof body.size === 'string' ? body.size.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;

    if (!modelName) {
      return ApiResponse.error('model_name is required', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return ApiResponse.error('quantity must be a positive number', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const supabase = await createServerClient(true);

    const { data: order, error: orderError } = await supabase
      .from('production_orders')
      .select('id, total_quantity, total_lines')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return ApiResponse.error('Замовлення не знайдено', ERROR_CODES.NOT_FOUND, 404);
    }

    const { data: createdLine, error: insertError } = await supabase
      .from('production_order_lines')
      .insert({
        order_id: orderId,
        model_id: body.model_id ? Number(body.model_id) : null,
        model_name: modelName,
        model_sku: modelSku,
        size,
        quantity,
        notes,
      })
      .select()
      .single();

    if (insertError) return ApiResponse.handle(insertError, 'production_order_line_create');

    await supabase
      .from('production_orders')
      .update({
        total_quantity: Number(order.total_quantity || 0) + quantity,
        total_lines: Number(order.total_lines || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // Background log
    supabase.rpc('log_production_order_field_change', {
      p_order_id: orderId,
      p_change_type: 'line_added',
      p_field_name: 'production_order_lines',
      p_old_value: null,
      p_new_value: { model_name: modelName, model_sku: modelSku, size, quantity, notes },
      p_note: 'Added production order line',
      p_payload: { source: 'api.production-orders.lines.post', line_id: createdLine?.id || null },
      p_changed_by: auth.userId,
    }).then(({ error }) => { if (error) console.warn('[ProductionOrder] Line add log failed:', error.message); });

    return ApiResponse.success(createdLine, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'production_order_line_create');
  }
}
