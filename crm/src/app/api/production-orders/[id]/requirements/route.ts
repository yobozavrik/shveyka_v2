import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

/**
 * GET /api/production-orders/:id/requirements
 *
 * Returns material requirements for a production order with overall readiness status.
 * Recalculates availability from current inventory_balances before returning.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const orderId = parseInt(resolvedParams.id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const supabase = await createServerClient(true);

    // Fetch order info
    const { data: order, error: orderError } = await supabase
      .from('production_orders')
      .select('id, order_number, status, priority')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
    }

    // Refresh requirements to get current stock availability
    const { error: calcError } = await supabase.rpc('calculate_material_requirements', {
      p_order_id: orderId,
    });

    if (calcError) {
      console.error('[Requirements] Recalc error:', calcError);
      // Don't fail — return existing data if recalc failed
    }

    // Fetch requirements
    const { data: requirements, error: reqError } = await supabase
      .from('production_order_materials')
      .select(`
        id,
        material_id,
        material_name,
        required_quantity,
        available_quantity,
        shortage_quantity,
        unit,
        item_type,
        unit_of_measure,
        calculation_source,
        notes
      `)
      .eq('order_id', orderId)
      .order('material_name');

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 });
    }

    const materials = requirements || [];

    // Determine overall status
    const hasShortage = materials.some(
      (r) => parseFloat(String(r.shortage_quantity)) > 0
    );

    return NextResponse.json({
      order_id: orderId,
      order_number: order.order_number,
      order_status: order.status,
      overall_status: hasShortage ? 'shortage' : 'ok',
      has_shortage: hasShortage,
      can_launch: order.status === 'approved',
      materials: materials.map((r) => ({
        id: r.id,
        material_id: r.material_id,
        material_name: r.material_name,
        item_type: r.item_type,
        unit_of_measure: r.unit_of_measure || r.unit,
        required_quantity: parseFloat(String(r.required_quantity)),
        available_quantity: parseFloat(String(r.available_quantity)),
        shortage_quantity: parseFloat(String(r.shortage_quantity)),
        status: parseFloat(String(r.shortage_quantity)) > 0 ? 'shortage' : 'ok',
      })),
    });
  } catch (e: any) {
    console.error('[Requirements] Exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
