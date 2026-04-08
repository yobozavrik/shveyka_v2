import { supabaseAdmin } from '../../../../lib/supabase/admin';

export class SupabaseRepository {
  /**
   * Получить активные производственные партии
   */
  async getActiveBatches() {
    const { data, error } = await supabaseAdmin
      .from('production_batches')
      .select(`
        batch_number, 
        quantity, 
        status, 
        is_urgent,
        priority,
        planned_end_date,
        product_models(name)
      `)
      .in('status', ['created', 'cutting', 'sewing'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw new Error(`Ошибка Supabase (Batches): ${error.message}`);
    return data || [];
  }

  /**
   * Получить последние записи об операциях
   */
  async getRecentOperationEntries() {
    const { data, error } = await supabaseAdmin
      .from('operation_entries')
      .select(`
        quantity, 
        status, 
        created_at,
        operations(name),
        production_batches(batch_number)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(`Ошибка Supabase (Entries): ${error.message}`);
    return data || [];
  }
}
