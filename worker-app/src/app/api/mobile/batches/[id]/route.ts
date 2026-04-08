import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const shveykaClient = getSupabaseAdmin('shveyka');

  const { data: batch, error } = await shveykaClient
    .from('production_batches')
    .select(`
      id, batch_number, status, quantity, size_variants, is_urgent, priority,
      planned_start_date, planned_end_date, actual_start_date, actual_end_date,
      fabric_type, fabric_color, thread_number, embroidery_type, embroidery_color,
      nastyl_number, notes, created_at,
      product_models(id, name, sku, category),
      employees!production_batches_supervisor_id_fkey(id, full_name, phone),
      production_orders(id, order_number, customer_name, status, priority)
    `)
    .eq('id', id)
    .single();

  if (error || !batch) {
    console.error('Batch error:', error);
    return NextResponse.json({ error: 'Партія не знайдена' }, { status: 404 });
  }

  return NextResponse.json(batch);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { size_variants, quantity, status } = body;

  const updateData: any = {};
  if (size_variants !== undefined) updateData.size_variants = size_variants;
  if (quantity !== undefined) updateData.quantity = quantity;
  if (status !== undefined) updateData.status = status;

  const shveykaClient = getSupabaseAdmin('shveyka');

  const { data, error } = await shveykaClient
    .from('production_batches')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Batch update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
