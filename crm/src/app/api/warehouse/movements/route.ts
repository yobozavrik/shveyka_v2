import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { recordAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const supabase = await createServerClient(true);

    let query = supabase
      .from('stock_ledger_entries')
      .select(`
        *,
        items(id, name, sku, unit),
        batches(id, batch_number),
        source:source_location_id(id, name),
        target:target_location_id(id, name)
      `)
      .order('transaction_date', { ascending: false });

    const itemId = searchParams.get('item_id');
    if (itemId) query = query.eq('item_id', parseInt(itemId));

    const limit = parseInt(searchParams.get('limit') || '50');
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error fetching movements:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('Movements GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createServerClient(true); // admin client for ledger

    // Create double-entry ledger movement
    // Requires: item_id, source_location_id, target_location_id, qty
    const { data: movement, error: moveErr } = await supabase
      .from('stock_ledger_entries')
      .insert({
        item_id: body.item_id,
        batch_id: body.batch_id || null,
        source_location_id: body.source_location_id,
        target_location_id: body.target_location_id,
        qty: body.qty, // MUST BE POSITIVE
        reference_type: body.reference_type || 'manual_adjustment',
        reference_id: body.reference_id || null,
        comment: body.comment || body.notes || 'Ручне коригування',
        employee_id: auth.userId,
      })
      .select()
      .single();

    if (moveErr) {
      console.error('Supabase error creating ledger entry:', moveErr);
      return NextResponse.json({ error: moveErr.message }, { status: 500 });
    }

    // Audit logging
    await recordAuditLog(
      supabase,
      auth.userId,
      'create',
      'stock_ledger_entries',
      movement.id,
      null,
      movement,
      request.headers.get('user-agent'),
      request.headers.get('x-forwarded-for')
    );

    return NextResponse.json(movement, { status: 201 });
  } catch (e: any) {
    console.error('Movements POST exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
