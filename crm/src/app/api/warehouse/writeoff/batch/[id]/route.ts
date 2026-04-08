import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const batchId = parseInt(id);
  const supabase = await createServerClient(true);

  // Get batch & model
  const { data: batch } = await supabase
    .from('production_batches')
    .select('quantity, product_model_id')
    .eq('id', batchId)
    .single();

  if (!batch) return NextResponse.json({ error: 'Партію не знайдено' }, { status: 404 });

  // Get norms
  const { data: norms } = await supabase
    .from('material_norms')
    .select('material_id, quantity_per_unit')
    .eq('product_model_id', batch.product_model_id);

  if (!norms || norms.length === 0) {
    return NextResponse.json({ message: 'Норми не задані', writeoffs: [] });
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
    await supabase.from('stock_movements').insert({
      material_id: norm.material_id,
      movement_type: 'batch_writeoff',
      quantity: -qty,
      reference_id: batchId,
      reference_type: 'production_batch',
      notes: `Списання на партію #${batchId}`,
      created_by: auth.userId,
    });

    writeoffs.push({ material_id: norm.material_id, quantity: qty });
  }

  return NextResponse.json({ success: true, writeoffs });
}
