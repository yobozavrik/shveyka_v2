import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orderId = parseInt(id, 10);

  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  const supabase = await createServerClient(true);

  const eventsRes = await supabase
    .from('production_order_events')
    .select('id, action, from_status, to_status, stage_label, note, payload, created_by, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (eventsRes.error) {
    return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
  }

  const events = Array.isArray(eventsRes.data) ? eventsRes.data.map((event) => ({
    ...event,
    entry_type: 'event',
  })) : [];

  return NextResponse.json(events);
}
