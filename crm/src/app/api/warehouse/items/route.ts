import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { recordAuditLog } from '@/lib/audit';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient(true);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const locationId = searchParams.get('location_id');

    // Query items
    let query = supabase
      .from('items')
      .select(`
        id, sku, name, item_type, unit, has_batches, has_variants,
        price_per_unit, notes, created_at
      `)
      .order('name');

    if (q) query = query.ilike('name', `%${q}%`);

    const { data: items, error } = await query;
    if (error) {
      return ApiResponse.handle(error, 'warehouse_items');
    }

    // Now let's fetch inventory balances for these items
    let balancesQuery = supabase.from('inventory_balances').select('*');
    if (locationId) {
       balancesQuery = balancesQuery.eq('location_id', locationId); // filter by location
    }

    const { data: balances, error: balErr } = await balancesQuery;
    if (balErr) console.warn('Could not fetch balances:', balErr);

    // Merge in JS
    const result = (items || []).map(item => {
      // Find all balances for this item
      const itemBalances = (balances || []).filter(b => b.item_id === item.id);
      // Aggregate total stock (across all fetched locations)
      const totalStock = itemBalances.reduce((sum, b) => sum + (parseFloat(b.on_hand) || 0), 0);
      
      return {
        ...item,
        current_stock: totalStock, // Maintain backwards compatibility for simple views
        balances: itemBalances
      };
    });
    
    return ApiResponse.success(result);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_items');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('items')
      .insert({
        sku: body.sku || body.code, // Support old 'code' payload
        name: body.name,
        item_type: body.item_type || body.category || 'raw_material',
        unit: body.unit || 'м',
        has_batches: body.has_batches || false,
        price_per_unit: body.price_per_unit || body.cost_per_unit || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return ApiResponse.handle(error, 'warehouse_items');
    }

    await recordAuditLog({
      action: 'CREATE',
      entityType: 'items',
      entityId: String(data.id),
      newData: data,
      request: request,
      auth: { id: auth.userId, username: auth.username },
    });

    return ApiResponse.success(data, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_items');
  }
}
