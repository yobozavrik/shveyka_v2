import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient(true);

    const today = new Date().toISOString().split('T')[0];

    const [
      { count: itemCount },
      { count: locCount },
      { count: todayMovements },
      { data: itemsList },
      { data: balances },
      { data: recentDocs },
      { data: recentMovements },
    ] = await Promise.all([
      supabase.from('items').select('*', { count: 'exact', head: true }),
      supabase.from('locations').select('*', { count: 'exact', head: true }),
      supabase
        .from('stock_ledger_entries')
        .select('*', { count: 'exact', head: true })
        .gte('transaction_date', today),
      supabase
        .from('items')
        .select('id, name, sku, unit, min_stock, price_per_unit'),
      supabase
        .from('inventory_balances')
        .select('item_id, on_hand, location_id'),
      supabase
        .from('supply_documents')
        .select('id, doc_number, status, doc_date, total_amount, suppliers(name)')
        .order('doc_date', { ascending: false })
        .limit(5),
      supabase
        .from('stock_ledger_entries')
        .select('id, transaction_date, qty, comment, items(name, unit), source:source_location_id(name), target:target_location_id(name)')
        .order('transaction_date', { ascending: false })
        .limit(10),
    ]);

    // Aggregate stock per item across all locations
    const stockByItem: Record<number, number> = {};
    for (const b of balances || []) {
      stockByItem[b.item_id] = (stockByItem[b.item_id] || 0) + Number(b.on_hand);
    }

    // Total stock value
    const totalStockValue = (itemsList || []).reduce((sum, item) => {
      const stock = stockByItem[item.id] || 0;
      return sum + stock * (item.price_per_unit || 0);
    }, 0);

    // Low stock items
    const lowStockItems = (itemsList || [])
      .filter(item => item.min_stock !== null && item.min_stock !== undefined && (stockByItem[item.id] || 0) <= item.min_stock)
      .map(item => ({ ...item, current_stock: stockByItem[item.id] || 0 }));

    // Enrich items list with current stock
    const itemsWithStock = (itemsList || []).map(item => ({
      ...item,
      current_stock: stockByItem[item.id] || 0,
    }));

    return NextResponse.json({
      total_items: itemCount || 0,
      total_locations: locCount || 0,
      today_movements: todayMovements || 0,
      total_stock_value: totalStockValue,
      low_stock_count: lowStockItems.length,
      low_stock_items: lowStockItems,
      items: itemsWithStock,
      recent_documents: recentDocs || [],
      recent_movements: recentMovements || [],
    });
  } catch (e: any) {
    console.error('Warehouse dashboard error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
