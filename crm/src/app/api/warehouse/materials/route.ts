import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth, getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient(true);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    let query = supabase
      .from('materials')
      .select(`
        id, code, name, category, unit, current_stock, min_stock,
        price_per_unit, notes, created_at
      `)
      .order('name');

    if (q) query = query.ilike('name', `%${q}%`);

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error fetching materials:', error);
      return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    }
    
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('Materials GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('materials')
      .insert({
        code: body.code,
        name: body.name,
        category: body.category || body.material_type || 'fabric',
        unit: body.unit || 'м',
        current_stock: parseFloat(body.current_stock) || 0,
        min_stock: parseFloat(body.min_stock) || 0,
        price_per_unit: body.price_per_unit || body.cost_per_unit || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating material:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('Materials POST exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
