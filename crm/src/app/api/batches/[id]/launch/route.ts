import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

const ALLOWED_ROLES = ['admin', 'manager', 'master', 'production_head'];
const ACTIVE_TASK_STATUSES = ['pending', 'accepted', 'in_progress'];
const CUTTING_STAGE_CODE = 'cutting';

type Params = { params: Promise<{ id: string }> };

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

async function loadBatch(batchId: number) {
  const shveyka = await createServerClient(true);
  return shveyka
    .from('production_batches')
    .select('id, batch_number, status, quantity, actual_start_date, updated_at')
    .eq('id', batchId)
    .single();
}

async function loadStage(stageCode: string) {
  const shveyka = await createServerClient(true);
  return shveyka
    .from('production_stages')
    .select('id, code, name, assigned_role, sequence_order, color, is_active')
    .eq('code', stageCode)
    .eq('is_active', true)
    .single();
}

async function updateBatchStatus(
  batch: { id: number; actual_start_date: string | null },
  status: string
) {
  const now = new Date().toISOString();
  const shveyka = await createServerClient(true);

  const shveykaUpdate = await shveyka
    .from('production_batches')
    .update({
      status,
      actual_start_date: batch.actual_start_date || todayIsoDate(),
      updated_at: now,
    })
    .eq('id', batch.id)
    .select('id, batch_number, status, quantity, actual_start_date, updated_at')
    .single();

  if (shveykaUpdate.error || !shveykaUpdate.data) {
    return { error: shveykaUpdate.error, data: null as any, stage: 'shveyka' as const };
  }

  return { error: null, data: { shveyka: shveykaUpdate.data }, stage: 'done' as const };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const batchId = Number(id);
    if (!Number.isFinite(batchId)) {
      return ApiResponse.error('Некоректний ідентифікатор партії', ERROR_CODES.BAD_REQUEST, 400);
    }

    const body = await request.json().catch(() => ({}));
    const note = typeof body?.note === 'string' ? body.note.trim() : null;

    const { data: batch, error: batchError } = await loadBatch(batchId);
    if (batchError || !batch) {
      return ApiResponse.error('Партію не знайдено', ERROR_CODES.NOT_FOUND, 404);
    }

    const { data: stage, error: stageError } = await loadStage(CUTTING_STAGE_CODE);
    if (stageError || !stage) {
      return ApiResponse.error('Не вдалося знайти етап для запуску партії', ERROR_CODES.INTERNAL_ERROR, 500);
    }

    const shveyka = await createServerClient(true);

    if (batch.status !== 'created') {
      return ApiResponse.error(
        `Запуск можливий лише для партії у статусі "created". Поточний статус: "${batch.status}"`,
        ERROR_CODES.BAD_REQUEST,
        400
      );
    }

    const { data: activeTasks, error: taskCheckError } = await shveyka
      .from('batch_tasks')
      .select('id, status')
      .eq('batch_id', batchId)
      .in('status', ACTIVE_TASK_STATUSES);

    if (taskCheckError) {
      return ApiResponse.handle(taskCheckError, 'batches_launch');
    }

    if ((activeTasks || []).length > 0) {
      return ApiResponse.error(
        'Для цієї партії вже існує активне завдання розкрою',
        ERROR_CODES.BAD_REQUEST,
        400,
        { active_tasks: activeTasks }
      );
    }

    const { data: task, error: taskInsertError } = await shveyka
      .from('batch_tasks')
      .insert({
        batch_id: batchId,
        stage_id: stage.id,
        task_type: stage.code,
        assigned_role: stage.assigned_role,
        status: 'pending',
        launched_by_user_id: auth.userId,
        launched_at: new Date().toISOString(),
        notes: note,
      })
      .select(`
        id, batch_id, stage_id, task_type, assigned_role, status,
        launched_by_user_id, launched_at, notes, created_at, updated_at,
        production_stages!batch_tasks_stage_id_fkey(
          id, code, name, assigned_role, sequence_order, color, is_active
        )
      `)
      .single();

    if (taskInsertError || !task) {
      return ApiResponse.handle(taskInsertError || new Error('Не вдалося створити завдання'), 'batches_launch');
    }

    const updated = await updateBatchStatus(batch, 'cutting');

    if (updated.error) {
      await shveyka.from('batch_tasks').delete().eq('id', task.id);
      return ApiResponse.handle(updated.error, 'batches_launch');
    }

    try {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'UPDATE',
        entityType: 'batch',
        entityId: String(batchId),
        oldData: batch,
        newData: {
          ...updated.data?.shveyka,
          launch_task_id: task.id,
          launch_stage_id: stage.id,
          launch_stage_code: stage.code,
          launch_stage_name: stage.name,
          launch_role: stage.assigned_role,
        },
        request,
        auth: { id: auth.userId, username: auth.username },
      });
    } catch (auditError) {
      console.error('Batch launch audit error:', auditError);
    }

    return ApiResponse.success({
      message: 'Партію передано у розкрій',
      batch: updated.data?.shveyka,
      task,
    });
  } catch (error) {
    return ApiResponse.handle(error, 'batches_launch');
  }
}
