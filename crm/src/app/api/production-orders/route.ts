import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

const ORDER_CREATE_ROLES = ['admin', 'manager', 'master'];

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const orderType = searchParams.get('order_type');
  const id = searchParams.get('id');

  const supabase = await createServerClient(true);

  let query = supabase
    .from('production_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (id) query = query.eq('id', parseInt(id));
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length > 1) {
      query = query.in('status', statuses);
    } else if (statuses.length === 1) {
      query = query.eq('status', statuses[0]);
    }
  }
  if (orderType) query = query.eq('order_type', orderType);

  const { data, error } = await query;

  if (error) {
    console.error('[Production Orders] Error:', error);
    return NextResponse.json([]);
  }

  const orders = Array.isArray(data) ? data : [];
  const orderIds = orders.map((order: any) => order.id).filter(Boolean);
  const locationIds = orders.map((order: any) => order.target_location_id).filter(Boolean);

  const [linesRes, batchesRes, locationsRes] = await Promise.all([
    orderIds.length > 0
      ? supabase.from('production_order_lines').select('*').in('order_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length > 0
      ? supabase
          .from('production_batches')
          .select('id, batch_number, status, quantity, product_model_id, route_card_id, sku, created_at, order_id')
          .in('order_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length > 0
      ? supabase.from('locations').select('id, name, type').in('id', locationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const linesByOrderId = new Map<number, any[]>();
  const batchesByOrderId = new Map<number, any[]>();
  const locationsById = new Map<number, any>();

  if (!linesRes.error && Array.isArray(linesRes.data)) {
    for (const line of linesRes.data) {
      const key = Number((line as any).order_id);
      if (!linesByOrderId.has(key)) linesByOrderId.set(key, []);
      linesByOrderId.get(key)!.push(line);
    }
  }

  if (!batchesRes.error && Array.isArray(batchesRes.data)) {
    for (const batch of batchesRes.data) {
      const key = Number((batch as any).order_id);
      if (!batchesByOrderId.has(key)) batchesByOrderId.set(key, []);
      batchesByOrderId.get(key)!.push(batch);
    }
  }

  if (!locationsRes.error && Array.isArray(locationsRes.data)) {
    for (const location of locationsRes.data) {
      locationsById.set(Number((location as any).id), location);
    }
  }

  return NextResponse.json(
    orders.map((order: any) => ({
      ...order,
      lines: linesByOrderId.get(Number(order.id)) || [],
      batches: batchesByOrderId.get(Number(order.id)) || [],
      target_location: order.target_location_id
        ? locationsById.get(Number(order.target_location_id)) || null
        : null,
    }))
  );
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !ORDER_CREATE_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Р”РѕСЃС‚СѓРї Р·Р°Р±РѕСЂРѕРЅРµРЅРѕ' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = await createServerClient(true);
  const targetLocationId = body.target_location_id ? Number(body.target_location_id) : null;

  const { data: recentOrders } = await supabase
    .from('production_orders')
    .select('order_number')
    .order('id', { ascending: false })
    .limit(1000);

  const nextNum = (Array.isArray(recentOrders) ? recentOrders : [])
    .map((row: any) => Number(String(row.order_number).trim()))
    .filter((n: number) => Number.isInteger(n) && n > 0)
    .reduce((max: number, n: number) => Math.max(max, n), 0) + 1;
  const orderNumber = String(nextNum);

  const { lines, ...orderData } = body;

  const { data: order, error: orderError } = await supabase
    .from('production_orders')
    .insert({
      ...orderData,
      target_location_id: targetLocationId,
      order_number: orderNumber,
      order_date: new Date().toISOString().split('T')[0],
      status: 'draft',
      created_by: auth.userId,
    })
    .select()
    .single();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (lines && lines.length > 0) {
    const linesData = lines.map((l: any) => ({
      ...l,
      order_id: order.id,
    }));

    const { error: linesError } = await supabase
      .from('production_order_lines')
      .insert(linesData);

    if (linesError) {
      console.error('[Production Orders] Lines error:', linesError);
    }

    const totalQty = lines.reduce((sum: number, l: any) => sum + l.quantity, 0);
    await supabase
      .from('production_orders')
      .update({
        total_quantity: totalQty,
        total_lines: lines.length,
      })
      .eq('id', order.id);
  }

  return NextResponse.json(order);
}
