import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const supabase = await createServerClient(true);

  let query = supabase
    .from('supply_documents')
    .select('*, suppliers(id, name), supply_items(*, items(id, name, unit))')
    .order('doc_date', { ascending: false });

  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);

  const limit = parseInt(searchParams.get('limit') || '50');
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = await createServerClient();

  // Auto-generate doc_number
  const { count } = await supabase.from('supply_documents').select('*', { count: 'exact', head: true });
  const docNumber = `PN-${String((count || 0) + 1).padStart(6, '0')}`;

  // Calculate total
  const items: Array<{ item_id: number; quantity: number; price: number }> = body.items || [];
  const totalAmount = items.reduce((s, i) => s + i.quantity * i.price, 0);

// Create document
  const { data: doc, error: docErr } = await supabase
    .from('supply_documents')
    .insert({
      doc_number: docNumber,
      supplier_id: body.supplier_id,
      target_location_id: body.target_location_id || null,
      doc_date: body.doc_date || new Date().toISOString().split('T')[0],
      total_amount: totalAmount,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });


  // Create items
  if (items.length > 0) {
    const rows = items.map(i => ({
      supply_document_id: doc.id,
      item_id: i.item_id,
      quantity: i.quantity,
      price: i.price,
      total: i.quantity * i.price,
    }));

    const { error: itemsErr } = await supabase.from('supply_items').insert(rows);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json(doc, { status: 201 });
}
