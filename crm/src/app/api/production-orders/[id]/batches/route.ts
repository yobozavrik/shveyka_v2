import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

const ManualBatchSchema = z.object({
  model_id: z.number(),
  quantity: z.number().int().positive(),
  planned_start_date: z.string().optional().nullable(),
  fabric_type: z.string().optional().nullable(),
  fabric_colors: z.array(z.object({
    color: z.string(),
    rolls: z.number().int().positive(),
  })).optional().nullable(),
  selected_sizes: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const ALLOWED_ROLES = ['admin', 'manager', 'master'];

function normalizeColors(fabricColors?: { color: string; rolls: number }[] | null) {
  if (!Array.isArray(fabricColors)) return null;
  const cleaned = fabricColors
    .map((item) => {
      const color = String(item.color).trim();
      const rolls = Number(item.rolls);
      if (!color || !Number.isFinite(rolls) || rolls < 1) return null;
      return `${color} (${Math.trunc(rolls)})`;
    })
    .filter(Boolean) as string[];
  return cleaned.length > 0 ? cleaned.join(', ') : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const resolvedParams = await params;
  const orderId = parseInt(resolvedParams.id, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  const supabase = await createServerClient(true);
  const body = await request.json().catch(() => ({}));
  const parsed = ManualBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Помилка валідації', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  const { data: order, error: orderError } = await supabase
    .from('production_orders')
    .select('id, order_number, status, priority, notes, planned_completion_date')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
  }

  if (!['approved', 'launched', 'in_production'].includes(order.status)) {
    return NextResponse.json(
      { error: `Створити партію можна лише для замовлення у статусі approved, launched або in_production. Поточний статус: "${order.status}"` },
      { status: 400 }
    );
  }

  const { data: lines, error: linesError } = await supabase
    .from('production_order_lines')
    .select('id, model_id, model_name, model_sku, quantity, size, notes')
    .eq('order_id', orderId);

  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 });
  }

  const line = (lines || []).find((item) => Number(item.model_id) === payload.model_id);
  if (!line) {
    return NextResponse.json(
      { error: 'Обрана позиція не належить цьому замовленню' },
      { status: 400 }
    );
  }

  const { data: existingBatches, error: batchesError } = await supabase
    .from('production_batches')
    .select('id')
    .eq('order_id', orderId);

  if (batchesError) {
    return NextResponse.json({ error: batchesError.message }, { status: 500 });
  }

  const nextIndex = (existingBatches || []).length + 1;
  const batchNumber = `${order.order_number}-${String(nextIndex).padStart(2, '0')}`;
  const quantity = payload.quantity;
  const fabricColor = normalizeColors(payload.fabric_colors);
  const selectedSizes = Array.isArray(payload.selected_sizes) ? payload.selected_sizes.filter(Boolean) : [];
  const sizeVariants = selectedSizes.length > 0 ? { selected_sizes: selectedSizes } : null;

  const { data: createdBatch, error: createError } = await supabase
    .from('production_batches')
    .insert({
      order_id: orderId,
      batch_number: batchNumber,
      product_model_id: payload.model_id,
      sku: line.model_sku || null,
      quantity,
      status: 'created',
      priority: order.priority || 'normal',
      notes: payload.notes || line.notes || order.notes || null,
      planned_start_date: payload.planned_start_date || null,
      planned_end_date: order.planned_completion_date || null,
      fabric_type: payload.fabric_type || null,
      fabric_color: fabricColor,
      size_variants: sizeVariants,
      route_card_id: null,
      is_urgent: order.priority === 'urgent',
    })
    .select('id, batch_number, status, quantity, product_model_id, sku, planned_start_date, fabric_type, fabric_color, size_variants')
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  await supabase.rpc('log_production_order_event', {
    p_order_id: orderId,
    p_action: 'create_batch',
    p_from_status: order.status,
    p_to_status: order.status,
    p_stage_label: 'manual_batch',
    p_note: payload.notes || null,
    p_payload: {
      batch_id: createdBatch?.id,
      batch_number: createdBatch?.batch_number,
      model_id: payload.model_id,
      quantity,
    },
    p_created_by: auth.userId,
  });

  return NextResponse.json(createdBatch, { status: 201 });
}
