import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient(true);
    const body = await request.json();

    const { base_model_id, order_type, planned_completion_date, total_quantity, target_location_id } = body;

    // Генерируем номер заказа
    const orderNumber = `PROD-${Date.now().toString().slice(-6)}`;

    const { data: order, error } = await supabase
      .from('production_orders')
      .insert({
        order_number: orderNumber,
        order_type: order_type || 'stock',
        status: 'draft',
        base_model_id,
        planned_completion_date,
        total_quantity: total_quantity || 0,
        target_location_id: target_location_id || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
