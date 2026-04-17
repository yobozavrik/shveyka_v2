import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'local'; // 'local' | 'keycrm'

    if (source === 'keycrm') {
      const apiKey = process.env.KEYCRM_API_KEY;
      let apiUrl = process.env.KEYCRM_API_URL || '';
      
      if (apiUrl.includes('vyshyvanky-kosar.keycrm.app')) {
        apiUrl = 'https://openapi.keycrm.app/v1';
      }
      if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

      if (!apiKey || !apiUrl) {
        return ApiResponse.error('KeyCRM не налаштований', ERROR_CODES.INTERNAL_ERROR, 500);
      }

      const page = searchParams.get('page') || '1';
      const limit = searchParams.get('limit') || '50';
      const status = searchParams.get('status') || '';

      const url = new URL(`${apiUrl}/order`);
      url.searchParams.set('limit', limit);
      url.searchParams.set('page', page);
      url.searchParams.set('include', 'products,manager');
      if (status) url.searchParams.set('status', status);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('KeyCRM API Error:', res.status, errorText);
        return ApiResponse.error(`KeyCRM API error: ${res.status}`, ERROR_CODES.INTERNAL_ERROR, 502);
      }

      const json = await res.json();
      return ApiResponse.success(json);
    }

    // source === 'local'
    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('production_batches')
      .select('id, batch_number, status, quantity, is_urgent, priority, planned_start_date, planned_end_date, created_at, notes, keycrm_id, product_model_id')
      .not('keycrm_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return ApiResponse.handle(error, 'orders_get_local');

    const rows = Array.isArray(data) ? data : [];
    const modelIds = [...new Set(rows.map((row: any) => row.product_model_id).filter(Boolean))];
    const modelsRes = modelIds.length > 0
      ? await supabase.from('product_models').select('id, name, sku, thumbnail_url').in('id', modelIds)
      : { data: [], error: null };

    const modelMap = new Map<number, any>();
    if (!modelsRes.error && Array.isArray(modelsRes.data)) {
      for (const model of modelsRes.data) modelMap.set(Number((model as any).id), model);
    }

    return ApiResponse.success(
      rows.map((row: any) => ({
        ...row,
        product_models: row.product_model_id ? modelMap.get(Number(row.product_model_id)) || null : null,
      }))
    );
  } catch (err: any) {
    return ApiResponse.handle(err, 'orders_get');
  }
}
