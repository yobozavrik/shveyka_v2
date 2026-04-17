import axios from 'axios';
import { createServerClient } from '@/lib/supabase/server';

const KEYCRM_URL = process.env.KEYCRM_API_URL;
const KEYCRM_KEY = process.env.KEYCRM_API_KEY;

export async function syncFromKeyCRM() {
  const supabase = await createServerClient();
  
  try {
    const response = await axios.get(`${KEYCRM_URL}/production/orders`, {
      headers: { Authorization: `Bearer ${KEYCRM_KEY}` }
    });

    const orders = response.data.data;
    const results = [];

    for (const order of orders) {
      // Basic deduplication by external_id
      const { data: existing } = await supabase
        .from('production_batches')
        .select('id')
        .eq('external_id', order.id.toString())
        .single();

      if (existing) continue;

      // Map KeyCRM order to MES Batch
      const { data: newBatch, error: _insertError } = await supabase
        .from('production_batches')
        .insert([{
          batch_number: `K-${order.id}`,
          external_id: order.id.toString(),
          external_system: 'keycrm',
          quantity: order.quantity || 1,
          status: 'created',
          sku: order.sku,
          notes: order.comment,
          launch_date: order.created_at?.split('T')[0]
        }])
        .select()
        .single();

      if (newBatch) results.push(newBatch);
    }

    return results;
  } catch (error: unknown) {
    const e = error as { response?: { data?: unknown }; message?: string };
    console.error('KeyCRM Sync Error:', e.response?.data || e.message);
    throw error;
  }
}
