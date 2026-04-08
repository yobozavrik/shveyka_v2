import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function POST() {
  const auth = await getAuth();
  if (!auth || auth.role !== 'admin') {
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
    console.error('[KeyCRM Sync] Missing env vars:', { hasApiKey: !!apiKey, hasApiUrl: !!apiUrl });
    return NextResponse.json({ error: 'KeyCRM не налаштований. Перевірте KEYCRM_API_KEY та KEYCRM_API_URL' }, { status: 500 });
  }

  const supabase = await createServerClient(true);
  let ordersFetched = 0;
  let batchesCreated = 0;
  let batchesUpdated = 0;
  let batchesSynced = 0;
  const errors: string[] = [];

  try {
    // Fetch orders from KeyCRM
    const res = await fetch(`${apiUrl}/order?limit=50&page=1&include=products`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`KeyCRM API error: ${res.status}`);
    const json = await res.json();
    const orders = json.data || [];
    ordersFetched = orders.length;

    for (const order of orders) {
      try {
        for (const product of order.products || []) {
          const productName = product.name || `Товар #${product.id}`;
          const quantity = product.quantity || 1;
          // Use composite ID: orderID-productID for unique batches per product in same order
          const kcmBatchId = `${order.id}-${product.id}`;

          // 1. Find or create product model
          const modelName = product.name || `Model ${product.sku}`;
          const modelSku = product.sku || `kcm-${product.id}`;
          const thumbnail_url = product.thumbnail_url || null;

          const { data: modelData } = await supabase
            .from('product_models')
            .select('id')
            .eq('keycrm_id', product.id)
            .maybeSingle();

          let legacyModelData = null;
          if (!modelData) {
            const { data } = await supabase
              .from('product_models')
              .select('id')
              .eq('sku', modelSku)
              .maybeSingle();
            legacyModelData = data;
          }

          let modelId;
          const resolvedModel = modelData || legacyModelData;

          if (resolvedModel) {
            modelId = resolvedModel.id;
            // Update name/photo if it changed
            await supabase
              .from('product_models')
              .update({
                keycrm_id: product.id,
                name: modelName,
                sku: modelSku,
                thumbnail_url,
                source_payload: product,
              })
              .eq('id', modelId);
          } else {
            const { data: newModel } = await supabase
              .from('product_models')
              .insert({
                keycrm_id: product.id,
                name: modelName,
                sku: modelSku,
                thumbnail_url,
                description: 'Синхронізовано з KeyCRM'
              })
              .select()
              .single();
            modelId = newModel?.id;
          }

          if (!modelId) continue;

          // 2. Check for existing batch by composite keycrm_id
          const { data: existing } = await supabase
            .from('production_batches')
            .select('id, quantity, status')
            .eq('keycrm_id', order.id) // Still checking order.id for legacy or change to composite?
            // Actually, let's use a new identifier or search for the order.id + model.id match
            .filter('batch_number', 'eq', `KCM-${order.id}-${product.id}`)
            .single();
          
          // To safely migrate, we try to find by batch_number which we'll now make more specific
          const newBatchNumber = `KCM-${order.id}-${product.id}`;

          if (!existing) {
            await supabase.from('production_batches').insert({
              batch_number: newBatchNumber,
              product_model_id: modelId,
              quantity,
              status: 'planned',
              keycrm_id: order.id, // Keep order.id for linking to order, but use batch_number for uniqueness
              notes: `Замовлення #${order.id} (KeyCRM)`,
              is_urgent: order.priority === 'high' || order.priority === 'urgent'
            });
            batchesCreated++;
          } else {
            if (existing.quantity !== quantity) {
                await supabase.from('production_batches')
                    .update({ quantity })
                    .eq('id', existing.id);
                batchesUpdated++;
            } else {
                batchesSynced++;
            }
          }
        }

      } catch (e: unknown) {
        errors.push(`Замовлення ${order.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Log sync
    try {
      await supabase.from('keycrm_sync_log').insert({
        external_system: 'keycrm',
        external_entity_type: 'order',
        external_entity_id: 'bulk_sync',
        sync_status: errors.length > 0 ? 'error' : 'success',
        sync_error: errors.length > 0 ? errors.join('; ') : null,
        response_data: JSON.stringify({
          orders_fetched: ordersFetched,
          batches_created: batchesCreated,
          batches_updated: batchesUpdated,
          batches_synced: batchesSynced
        })
      });
    } catch (logError) {
      console.error('[KeyCRM Sync] Failed to log sync:', logError);
    }

    return NextResponse.json({
      success: true,
      orders_fetched: ordersFetched,
      batches_created: batchesCreated,
      batches_updated: batchesUpdated,
      batches_synced: batchesSynced,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[KeyCRM Sync] Error:', msg);
    
    try {
      await supabase.from('keycrm_sync_log').insert({
        external_system: 'keycrm',
        external_entity_type: 'order',
        external_entity_id: 'bulk_sync_error',
        sync_status: 'error',
        sync_error: msg,
      });
    } catch (logError) {
      console.error('[KeyCRM Sync] Failed to log error:', logError);
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
