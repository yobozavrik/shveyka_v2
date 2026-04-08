import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-server';

export async function GET() {
  try {
    const auth = await requireAuth();
    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('route_cards')
      .select(`
        id, version, is_active, description, created_at, weight_grams,
        product_models(id, name, sku, source_payload, is_active)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error Route Cards GET:', error);
      return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    }
    
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
    console.error('Route Cards GET exception:', e);
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(['admin', 'manager', 'technologist']);
    const body = await request.json();
    const supabase = await createServerClient(true);

    if (!body.product_model_id) {
      return NextResponse.json({ error: 'product_model_id is required' }, { status: 400 });
    }

    const { data: model, error: modelErr } = await supabase
      .from('product_models')
      .select('id, source_payload, name, sku')
      .eq('id', Number(body.product_model_id))
      .single();

    if (modelErr || !model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const sourcePayload = model.source_payload as { seed?: boolean } | null;
    if (!sourcePayload || sourcePayload.seed !== true) {
      return NextResponse.json({ error: 'Route cards can be created only for seed models' }, { status: 400 });
    }

    // 1. Create route card
    const { data: rc, error: rcErr } = await supabase
      .from('route_cards')
      .insert({
        product_model_id: Number(body.product_model_id),
        version: body.version || 1,
        is_active: body.is_active !== false,
        description: body.description || null,
        weight_grams: body.weight_grams || 0,
      })
      .select()
      .single();

    if (rcErr) return NextResponse.json({ error: rcErr.message }, { status: 500 });

    return NextResponse.json(rc, { status: 201 });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
