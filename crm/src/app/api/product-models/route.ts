import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth, getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const supabase = await createServerClient(true);
    let query = supabase
      .from('product_models')
      .select('id, keycrm_id, name, sku, category, description, thumbnail_url, source_payload, is_active')
      .order('name');

    if (source === 'keycrm') {
      query = query.contains('source_payload', { seed: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error fetching product models:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('Product models GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('product_models')
      .insert({
        keycrm_id: body.keycrm_id || null,
        name: body.name,
        sku: body.sku,
        category: body.category || null,
        description: body.description || null,
        thumbnail_url: body.thumbnail_url || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating product model:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ЗАПИС В ЖУРНАЛ АУДИТУ
    if (auth) {
      const { recordAuditLog } = await import('@/lib/audit');
      recordAuditLog({
        action: 'CREATE',
        entityType: 'model',
        entityId: data.id.toString(),
        newData: data,
        request,
        auth: { id: auth.userId, username: auth.username }
      });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('Product models POST exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
