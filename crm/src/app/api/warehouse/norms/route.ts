import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const supabase = await createServerClient(true);

    let query = supabase
      .from('material_norms')
      .select('*, items!material_id(id, name, sku, unit), product_models(id, name, sku)')
      .order('product_model_id');

    const modelId = searchParams.get('model_id');
    if (modelId) query = query.eq('product_model_id', parseInt(modelId));

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (e: any) {
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
    if (!body.product_model_id || !body.material_id || !body.quantity_per_unit) {
      return NextResponse.json({ error: 'Обовʼязкові поля: product_model_id, material_id, quantity_per_unit' }, { status: 400 });
    }

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('material_norms')
      .upsert(
        {
          product_model_id: body.product_model_id,
          material_id: body.material_id,
          quantity_per_unit: body.quantity_per_unit,
        },
        { onConflict: 'product_model_id,material_id' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
