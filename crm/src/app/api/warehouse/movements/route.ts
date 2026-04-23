import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { recordAuditLog } from '@/lib/audit';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const supabase = await createServerClient(true);

    let query = supabase
      .from('stock_ledger_entries')
      .select(`
        *,
        items(id, name, sku, unit),
        batches(id, batch_number),
        source:source_location_id(id, name),
        target:target_location_id(id, name)
      `)
      .order('transaction_date', { ascending: false });

    const itemId = searchParams.get('item_id');
    if (itemId) query = query.eq('item_id', parseInt(itemId));

    const limit = parseInt(searchParams.get('limit') || '50');
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) return ApiResponse.handle(error, 'warehouse_movements_get');
    
    return ApiResponse.success(data || []);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_movements_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data: movement, error: moveErr } = await supabase
      .from('stock_ledger_entries')
      .insert({
        item_id: body.item_id,
        batch_id: body.batch_id || null,
        source_location_id: body.source_location_id,
        target_location_id: body.target_location_id,
        qty: body.qty,
        reference_type: body.reference_type || 'manual_adjustment',
        reference_id: body.reference_id || null,
        comment: body.comment || body.notes || 'Ручне коригування',
        employee_id: auth.userId,
      })
      .select()
      .single();

    if (moveErr) return ApiResponse.handle(moveErr, 'warehouse_movements_post');

    await recordAuditLog({
      action: 'CREATE',
      entityType: 'stock_ledger_entries',
      entityId: String(movement.id),
      newData: movement,
      request: request,
      auth: { id: auth.userId, username: auth.username },
    });

    return ApiResponse.success(movement, 201);
  } catch (e: any) {
    return ApiResponse.handle(e, 'warehouse_movements_post');
  }
}
