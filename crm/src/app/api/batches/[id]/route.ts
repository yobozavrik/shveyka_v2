import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('production_batches')
      .select('*, product_models(id, name, sku, sizes)')
      .eq('id', parseInt(id, 10))
      .single();

    if (error) return ApiResponse.handle(error, 'batches_id_get');
    if (!data) return ApiResponse.error('Не знайдено', ERROR_CODES.NOT_FOUND, 404);

    // ─── РАСЧЕТ ФАКТИЧЕСКОГО ПРОГРЕССА ───
    const { data: entries } = await supabase
      .from('task_entries')
      .select('id, quantity, data, operation_id, stage_id, employee_id, recorded_at')
      .eq('batch_id', parseInt(id, 10))
      .eq('status', 'approved')
      .order('recorded_at', { ascending: true });

    let actualTotal = 0;
    const actualBySize: Record<string, number> = {};

    if (entries) {
      for (const entry of entries) {
        actualTotal += Number(entry.quantity || 0);
        const sizes = entry.data?.sizes;
        if (sizes && typeof sizes === 'object') {
          for (const [size, count] of Object.entries(sizes)) {
            actualBySize[size] = (actualBySize[size] || 0) + Number(count);
          }
        }
      }
    }

    return ApiResponse.success({
      ...data,
      actuals: {
        total_qty: actualTotal,
        by_size: actualBySize,
        entries_count: entries?.length || 0
      }
    });
  } catch (error) {
    return ApiResponse.handle(error, 'batches_id_get');
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'master'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const batchId = parseInt(id, 10);
    const supabase = await createServerClient(true);
    const body = await req.json().catch(() => ({}));

    const { data: currentBatch, error: currentError } = await supabase
      .from('production_batches')
      .select('status')
      .eq('id', batchId)
      .single();

    if (currentError || !currentBatch) {
      return ApiResponse.error('Не знайдено', ERROR_CODES.NOT_FOUND, 404);
    }

    if (currentBatch.status !== 'created') {
      return ApiResponse.error('Партію можна редагувати лише до початку наступного етапу', ERROR_CODES.BAD_REQUEST, 400);
    }

    const allowed = [
      'batch_number', 'product_model_id', 'quantity', 'status', 'sku', 'notes',
      'priority', 'fabric_type', 'fabric_color', 'thread_number', 'embroidery_type',
      'embroidery_color', 'nastyl_number', 'supervisor_id', 'planned_start_date',
      'planned_end_date', 'is_urgent', 'size_variants',
    ];

    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const { data: oldData } = await supabase.from('production_batches').select('*').eq('id', batchId).single();

    const { data, error } = await supabase
      .from('production_batches')
      .update(update)
      .eq('id', batchId)
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'batches_id_put');

    const { recordAuditLog } = await import('@/lib/audit');
    await recordAuditLog({
      action: 'UPDATE',
      entityType: 'batch',
      entityId: String(batchId),
      oldData,
      newData: data,
      request: req,
      auth: { id: auth.userId, username: auth.username },
    });

    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'batches_id_put');
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'master'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const batchId = parseInt(id, 10);
    const supabase = await createServerClient(true);

    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .select('status')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return ApiResponse.error('Не знайдено', ERROR_CODES.NOT_FOUND, 404);
    }

    if (batch.status !== 'created') {
      return ApiResponse.error('Партію можна видаляти лише до початку наступного етапу', ERROR_CODES.BAD_REQUEST, 400);
    }

    const { data: oldData } = await supabase.from('production_batches').select('*').eq('id', batchId).single();

    // Delete child records first
    const { error: depError } = await supabase
      .from('task_entries')
      .delete()
      .eq('batch_id', batchId);

    if (depError) return ApiResponse.handle(depError, 'batches_id_delete_child');

    const { error } = await supabase.from('production_batches').delete().eq('id', batchId);
    if (error) return ApiResponse.handle(error, 'batches_id_delete');

    const { recordAuditLog } = await import('@/lib/audit');
    await recordAuditLog({
      action: 'DELETE',
      entityType: 'batch',
      entityId: String(batchId),
      oldData,
      request: _req,
      auth: { id: auth.userId, username: auth.username },
    });

    return ApiResponse.success({ success: true });
  } catch (error) {
    return ApiResponse.handle(error, 'batches_id_delete');
  }
}
