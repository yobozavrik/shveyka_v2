import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('material_norms')
    .select('*, items (id, name, sku, unit, price_per_unit)')
    .eq('product_model_id', parseInt(id))
    .eq('is_active', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('material_norms')
    .insert({
      product_model_id: parseInt(id),
      material_id: body.material_id,
      quantity_per_unit: body.quantity_per_unit,
      item_type: body.item_type || null,
      unit_of_measure: body.unit_of_measure || null,
      notes: body.notes || null,
      is_active: true
    })
    .select('*, items (id, name, sku, unit, price_per_unit)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
