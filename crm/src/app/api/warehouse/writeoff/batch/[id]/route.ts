import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const batchId = parseInt(id);
    const supabase = await createServerClient(true);

    // Get batch & model
    const { data: batch, error: batchErr } = await supabase
      .from('production_batches')
      .select('quantity, product_model_id')
      .eq('id', batchId)
      .single();

    if (batchErr || !batch) return ApiResponse.error('Партію не знайдено', ERROR_CODES.NOT_FOUND, 404);

    // Get norms
    const { data: norms, error: normsErr } = await supabase
      .from('material_norms')
      .select('material_id, quantity_per_unit')
      .eq('product_model_id', batch.product_model_id);

    if (normsErr) return ApiResponse.handle(normsErr, 'warehouse_writeoff');

    if (!norms || norms.length === 0) {
      return ApiResponse.success({ message: 'Норми не задані', writeoffs: [] });
    }

    const writeoffs = [];
    for (const norm of norms) {
      const qty = norm.quantity_per_unit * batch.quantity;

      // Deduct stock
      const { data: mat } = await supabase
        .from('materials')
        .select('current_stock')
        .eq('id', norm.material_id)
        .single();

      await supabase
        .from('materials')
        .update({ current_stock: Math.max(0, (mat?.current_stock || 0) - qty) })
        .eq('id', norm.material_id);

      // Create movement
      await supabase.from('stock_ledger_entries').insert({
        item_id: norm.material_id,
        movement_type: 'batch_writeoff',
        quantity: -qty,
        reference_id: batchId,
        reference_type: 'production_batch',
        notes: `Списання на партію #${batchId}`,
        created_by: auth.userId,
      });

      writeoffs.push({ material_id: norm.material_id, quantity: qty });
    }

    return ApiResponse.success({ success: true, writeoffs });
  } catch (error) {
    return ApiResponse.handle(error, 'warehouse_writeoff');
  }
}
