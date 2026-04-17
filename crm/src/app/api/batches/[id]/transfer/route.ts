import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { appLogger } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  { params }: Params
) {
  const auth = await getAuth();
  if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

  try {
    const { id } = await params;
    const batchId = parseInt(id, 10);
    const body = await request.json();
    const { source_location_id, target_location_id, quantity, notes } = body;

    if (!source_location_id || !target_location_id || !quantity) {
      return ApiResponse.error('Не всі обовʼязкові поля заповнені', ERROR_CODES.BAD_REQUEST, 400);
    }

    const supabase = await createServerClient(true);

    // 1. Проверяем наличие партии
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .select('id, batch_number, quantity, status')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return ApiResponse.error('Партію не знайдено', ERROR_CODES.NOT_FOUND, 404);
    }

    // 2. Создаем запись в журнале движений (Double-Entry)
    // Из источника (source) в цель (target)
    const { data: movement, error: moveError } = await supabase
      .from('stock_ledger_entries')
      .insert({
        item_id: null, // Это перемещение партии, а не конкретного материала
        batch_id: batchId,
        source_location_id,
        target_location_id,
        qty: quantity,
        reference_type: 'batch_transfer',
        reference_id: batchId,
        employee_id: auth.userId,
        comment: notes || `Переміщення партії ${batch.batch_number}`,
      })
      .select()
      .single();

    if (moveError) return ApiResponse.handle(moveError, 'batches_transfer');

    // 3. Обновляем текущую локацию партии (если нужно хранить в production_batches)
    // Допустим, мы просто логируем движение.

    // ЛОГ АУДИТА
    const { recordAuditLog } = await import('@/lib/audit');
    await recordAuditLog({
      action: 'UPDATE',
      entityType: 'batch',
      entityId: String(batchId),
      oldData: { location: source_location_id },
      newData: { location: target_location_id, movement_id: movement.id },
      request,
      auth: { id: auth.userId, username: auth.username },
    });

    return ApiResponse.success({ success: true, movement });
  } catch (err: any) {
    // ЛОГ ОШИБКИ
    const resolvedParams = await params;
    await appLogger({
      level: 'error',
      message: `Ошибка при переводе партии ${resolvedParams.id}: ${err.message}`,
      module: 'batches',
      action: 'transfer_error',
      userId: auth.userId?.toString(),
      username: auth.username,
      error: err.stack,
    });

    return ApiResponse.handle(err, 'batches_transfer');
  }
}
