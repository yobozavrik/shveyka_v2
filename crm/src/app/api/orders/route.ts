import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'local'; // 'local' | 'keycrm'

  if (source === 'keycrm') {
    const apiKey = process.env.KEYCRM_API_KEY;
    let apiUrl = process.env.KEYCRM_API_URL || '';
    
    // Force correct API URL if stale env var is present
    if (apiUrl.includes('vyshyvanky-kosar.keycrm.app')) {
      apiUrl = 'https://openapi.keycrm.app/v1';
    }

    // Clean trailing slash
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

    if (!apiKey || !apiUrl) {
      return NextResponse.json({ error: 'KeyCRM не налаштований' }, { status: 500 });
    }

    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';
    const status = searchParams.get('status') || '';

    try {
      const url = new URL(`${apiUrl}/order`);
      url.searchParams.set('limit', limit);
      url.searchParams.set('page', page);
      url.searchParams.set('include', 'products,manager');
      if (status) url.searchParams.set('status', status);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });

      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = { message: await res.text() };
        }
        console.error('KeyCRM API Error:', errorData);
        return NextResponse.json(
          { error: `KeyCRM API error: ${res.status}`, details: errorData }, 
          { status: 502 }
        );
      }

      const json = await res.json();
      return NextResponse.json(json);
    } catch (err: any) {
      console.error('KeyCRM Fetch Exception:', err);
      return NextResponse.json({ 
        error: 'Помилка з\'єднання з KeyCRM', 
        details: err.message,
        debug_url: apiUrl 
      }, { status: 500 });
    }
  }

  // source === 'local': batches created from KeyCRM
  const supabase = await createServerClient(true);
  const { data, error } = await supabase
    .from('production_batches')
    .select('id, batch_number, status, quantity, is_urgent, priority, planned_start_date, planned_end_date, created_at, notes, keycrm_id, product_model_id')
    .not('keycrm_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('[Orders] Local source fallback:', error.message);
    return NextResponse.json([]);
  }

  const rows = Array.isArray(data) ? data : [];
  const modelIds = [...new Set(rows.map((row: any) => row.product_model_id).filter(Boolean))];
  const modelsRes = modelIds.length > 0
    ? await supabase.from('product_models').select('id, name, sku, thumbnail_url').in('id', modelIds)
    : { data: [], error: null };

  const modelMap = new Map<number, any>();
  if (!modelsRes.error && Array.isArray(modelsRes.data)) {
    for (const model of modelsRes.data) modelMap.set(Number((model as any).id), model);
  }

  return NextResponse.json(
    rows.map((row: any) => ({
      ...row,
      product_models: row.product_model_id ? modelMap.get(Number(row.product_model_id)) || null : null,
    }))
  );
}
