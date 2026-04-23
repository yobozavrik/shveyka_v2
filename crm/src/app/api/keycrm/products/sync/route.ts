import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function POST() {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const apiKey = process.env.KEYCRM_API_KEY;
    let apiUrl = process.env.KEYCRM_API_URL || '';
    
    if (apiUrl.includes('vyshyvanky-kosar.keycrm.app')) {
      apiUrl = 'https://openapi.keycrm.app/v1';
    }
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

    if (!apiKey || !apiUrl) {
      return ApiResponse.error('KeyCRM не налаштований', ERROR_CODES.INTERNAL_ERROR, 500);
    }

    const supabase = await createServerClient(true);
    let created = 0;
    let updated = 0;

    // Fetch all products from KeyCRM (paginated)
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { 
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

    // Log success in background
    supabase.from('keycrm_sync_log').insert({
      external_system: 'keycrm',
      external_entity_type: 'product',
      external_entity_id: 'bulk_sync',
      sync_status: 'success',
      response_data: { created, updated }
    }).then(({ error }) => { if (error) console.error('[KeyCRM Products Sync] Failed to log sync:', error); });

    return ApiResponse.success({ success: true, created, updated });
  } catch (e: any) {
    return ApiResponse.handle(e, 'keycrm_products_sync');
  }
}
