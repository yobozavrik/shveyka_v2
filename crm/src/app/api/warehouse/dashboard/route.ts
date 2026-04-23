import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient(true);

    // 1. Stats
    const [{ count: itemCount }, { count: locCount }] = await Promise.all([
      supabase.from('items').select('*', { count: 'exact', head: true }),
      supabase.from('locations').select('*', { count: 'exact', head: true }),
    ]);

    // 2. Today movements
    const today = new Date().toISOString().split('T')[0];
    const { count: todayMovements } = await supabase
      .from('stock_ledger_entries')
      .select('*', { count: 'exact', head: true })
      .gte('transaction_date', today);

    // 3. Low stock items
    const { data: lowStockItems } = await supabase
      .from('items')
      .select('id, name, sku, unit, current_stock, min_stock')
      .lt('current_stock', 'min_stock') // error? wait, supabase might not support column vs column in lt
      .limit(10);
    
    // Fallback for low stock (client side filter or proper sql)
    const { data: allItems } = await supabase
      .from('items')
      .select('id, name, sku, unit, current_stock, min_stock, price_per_unit')
      .eq('is_active', true);

    const filteredLowStock = (allItems || []).filter(item => 
      (item.current_stock || 0) <= (item.min_stock || 0)
    );

    const totalStockValue = (allItems || []).reduce((sum, item) => 
      sum + (Number(item.current_stock || 0) * Number(item.price_per_unit || 0)), 0
    );

    // 4. Items with stock
    const itemsWithStock = (allItems || []).filter(item => (item.current_stock || 0) > 0);

    // 5. Recent documents
    const { data: recentDocs } = await supabase
      .from('supply_documents')
      .select('*, suppliers(name)')
      .order('created_at', { ascending: false })
      .limit(5);

    // 6. Recent movements
    const { data: recentMovements } = await supabase
      .from('stock_ledger_entries')
      .select('*, items(name, unit), source:source_location_id(name), target:target_location_id(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    return ApiResponse.success({
      total_items: itemCount || 0,
      total_locations: locCount || 0,
      today_movements: todayMovements || 0,
      total_stock_value: totalStockValue,
      low_stock_count: filteredLowStock.length,
      low_stock_items: filteredLowStock.slice(0, 10),
      items: itemsWithStock,
      recent_documents: recentDocs || [],
      recent_movements: recentMovements || [],
    });
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_dashboard');
  }
}
