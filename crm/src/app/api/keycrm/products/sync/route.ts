import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function POST() {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const apiKey = process.env.KEYCRM_API_KEY;
  let apiUrl = process.env.KEYCRM_API_URL || '';
  
  // Force correct API URL if stale env var is present
  if (apiUrl.includes('vyshyvanky-kosar.keycrm.app')) {
    apiUrl = 'https://openapi.keycrm.app/v1';
  }

  if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

  if (!apiKey || !apiUrl) {
    console.error('[KeyCRM Products Sync] Missing env vars:', { hasApiKey: !!apiKey, hasApiUrl: !!apiUrl });
    return NextResponse.json({ error: 'KeyCRM не налаштований. Перевірте KEYCRM_API_KEY та KEYCRM_API_URL' }, { status: 500 });
  }

  const supabase = await createServerClient(true);
  let created = 0;
  let updated = 0;

  try {
    // Fetch all products from KeyCRM (paginated)
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { // Limit to 10 pages for safety, or increase if needed
      const res = await fetch(`${apiUrl}/products?limit=50&page=${page}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`KeyCRM API error: ${res.status}`);
      const json = await res.json();
      const products = json.data || [];

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      for (const product of products) {
        const name = product.name || `Product #${product.id}`;
        const sku = product.sku || `kcm-p-${product.id}`;
        const thumbnail_url = product.thumbnail_url || null;
        
        // Upsert to product_models
        const { data: existing } = await supabase
          .from('product_models')
          .select('id')
          .eq('keycrm_id', product.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('product_models')
            .update({
              name,
              sku,
              thumbnail_url,
              source_payload: product,
              is_active: true,
            })
            .eq('id', existing.id);
          updated++;
        } else {
          await supabase.from('product_models').insert({
            keycrm_id: product.id,
            name,
            sku,
            thumbnail_url,
            source_payload: product,
            is_active: true,
            description: 'Синхронізовано з KeyCRM',
          });
          created++;
        }
      }

      page++;
      if (!json.next_page_url) hasMore = false;
    }

    // Log success
    try {
      await supabase.from('keycrm_sync_log').insert({
        external_system: 'keycrm',
        external_entity_type: 'product',
        external_entity_id: 'bulk_sync',
        sync_status: 'success',
        response_data: JSON.stringify({ created, updated })
      });
    } catch (logError) {
      console.error('[KeyCRM Products Sync] Failed to log sync:', logError);
    }

    return NextResponse.json({ success: true, created, updated });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[KeyCRM Products Sync] Error:', errorMsg);
    
    // Log error
    try {
      await supabase.from('keycrm_sync_log').insert({
        external_system: 'keycrm',
        external_entity_type: 'product',
        external_entity_id: 'bulk_sync_error',
        sync_status: 'error',
        sync_error: errorMsg
      });
    } catch (logError) {
      console.error('[KeyCRM Products Sync] Failed to log error:', logError);
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
