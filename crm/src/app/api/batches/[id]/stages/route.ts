import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

type StageRow = {
  id: number;
  code: string;
  name: string;
  assigned_role: string;
  sequence_order: number;
  color: string | null;
  is_active: boolean;
};

type OperationRow = {
  id: number;
  stage_id: number;
  code: string;
  name: string;
};

type TaskRow = {
  id: number;
  batch_id: number;
  stage_id: number | null;
  task_type: string | null;
  assigned_role: string | null;
  status: string;
  launched_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  stage?: StageRow | StageRow[] | null;
};

type EntryRow = {
  id: number;
  batch_id: number;
  stage_id: number | null;
  operation_id: number | null;
  employee_id: number | null;
  entry_number: number | null;
  quantity: number | null;
  data: Record<string, any> | null;
  notes: string | null;
  recorded_at: string;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function sumQuantity(entries: EntryRow[]) {
  return entries.reduce((total, entry) => total + Number(entry.quantity || 0), 0);
}

function groupLatestTask(tasks: TaskRow[], stageId: number) {
  const stageTasks = tasks.filter((task) => task.stage_id === stageId);
  if (stageTasks.length === 0) return null;

  return [...stageTasks].sort((a, b) => {
    const left = new Date(a.launched_at || a.completed_at || 0).getTime();
    const right = new Date(b.launched_at || b.completed_at || 0).getTime();
    return right - left;
  })[0];
}

function groupEntries(entries: EntryRow[], stageId: number) {
  return entries.filter((entry) => entry.stage_id === stageId);
}

async function loadBatch(batchId: number) {
  const supabase = await createServerClient(true);
  return supabase
    .from('production_batches')
    .select('id, batch_number, status, quantity, actual_start_date, updated_at, product_model_id, product_models(id, name, sku, sizes)')
    .eq('id', batchId)
    .single();
}

async function loadStages() {
  const supabase = await createServerClient(true);
  return supabase
    .from('production_stages')
    .select('id, code, name, assigned_role, sequence_order, color, is_active')
    .eq('is_active', true)
    .order('sequence_order', { ascending: true })
    .order('name', { ascending: true });
}

async function loadTasks(batchId: number) {
  const supabase = await createServerClient(true);
  return supabase
    .from('batch_tasks')
    .select(`
      id, batch_id, stage_id, task_type, assigned_role, status,
      launched_at, accepted_at, completed_at, cancelled_at, notes,
      production_stages!batch_tasks_stage_id_fkey(
        id, code, name, assigned_role, sequence_order, color, is_active
      )
    `)
    .eq('batch_id', batchId)
    .order('launched_at', { ascending: false });
}

async function loadEntries(batchId: number) {
  const supabase = await createServerClient(true);
  return supabase
    .from('task_entries')
    .select('id, batch_id, stage_id, operation_id, employee_id, entry_number, quantity, data, notes, recorded_at')
    .eq('batch_id', batchId)
    .order('recorded_at', { ascending: true });
}

async function loadOperations() {
  const supabase = await createServerClient(true);
  return supabase
    .from('stage_operations')
    .select('id, stage_id, code, name')
    .eq('is_active', true);
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const batchId = Number(id);
  if (!Number.isFinite(batchId)) {
    return NextResponse.json({ error: 'Invalid batch id' }, { status: 400 });
  }

  const [{ data: batch, error: batchError }, { data: stages, error: stagesError }, { data: tasks, error: tasksError }, { data: entries, error: entriesError }, { data: operations, error: operationsError }] =
    await Promise.all([loadBatch(batchId), loadStages(), loadTasks(batchId), loadEntries(batchId), loadOperations()]);

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Партію не знайдено' }, { status: 404 });
  }

  if (stagesError) {
    return NextResponse.json({ error: stagesError.message }, { status: 500 });
  }

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }

  if (operationsError) {
    return NextResponse.json({ error: operationsError.message }, { status: 500 });
  }

  const operationsById = new Map<number, OperationRow>();
  ((operations || []) as OperationRow[]).forEach((operation) => {
    operationsById.set(operation.id, operation);
  });

  const normalizedStages = ((stages || []) as StageRow[]).map((stage) => {
    const stageEntries = groupEntries((entries || []) as EntryRow[], stage.id).map((entry) => {
      const operation = entry.operation_id ? operationsById.get(entry.operation_id) : null;
      return {
        ...entry,
        operation_code: operation?.code || null,
        operation_name: operation?.name || null,
      };
    });
    const task = groupLatestTask((tasks || []) as TaskRow[], stage.id);

    return {
      ...stage,
      task: task
        ? {
            id: task.id,
            status: task.status,
            task_type: task.task_type,
            assigned_role: task.assigned_role,
            launched_at: task.launched_at,
            accepted_at: task.accepted_at,
            completed_at: task.completed_at,
            cancelled_at: task.cancelled_at,
            notes: task.notes,
          }
        : null,
      entries_count: stageEntries.length,
      quantity_total: sumQuantity(stageEntries),
      latest_entry_at: stageEntries.length ? stageEntries[stageEntries.length - 1].recorded_at : null,
      is_current: batch.status === stage.code,
      is_completed: task?.status === 'completed',
      entries: stageEntries,
    };
  });

  const currentStage = normalizedStages.find((stage) => stage.code === batch.status) || null;
  const currentTask = currentStage?.task || null;
  const currentIndex = currentStage ? normalizedStages.findIndex((stage) => stage.id === currentStage.id) : -1;
  const nextStage = currentIndex >= 0 ? normalizedStages[currentIndex + 1] || null : null;
  const canTransferNext = Boolean(currentStage && currentTask && currentTask.status === 'completed' && nextStage);

  return NextResponse.json({
    batch: {
      ...batch,
      product_models: firstRelation((batch as any).product_models) || null,
    },
    stages: normalizedStages,
    current_stage: currentStage,
    current_task: currentTask,
    next_stage: nextStage,
    can_transfer_next: canTransferNext,
    completed_stages: normalizedStages.filter((stage) => stage.is_completed).length,
    total_entries: sumQuantity((entries || []) as EntryRow[]),
  });
}

export async function POST(request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'master', 'production_head'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const batchId = Number(id);
  if (!Number.isFinite(batchId)) {
    return NextResponse.json({ error: 'Invalid batch id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'advance').toLowerCase();
  if (action !== 'advance') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const supabase = await createServerClient(true);

  const { data: batch, error: batchError } = await loadBatch(batchId);
  if (batchError || !batch) {
    return NextResponse.json({ error: 'Партію не знайдено' }, { status: 404 });
  }

  const { data: stages, error: stagesError } = await loadStages();
  if (stagesError) {
    return NextResponse.json({ error: stagesError.message }, { status: 500 });
  }

  const orderedStages = (stages || []) as StageRow[];
  const currentStage = orderedStages.find((stage) => stage.code === batch.status) || null;
  if (!currentStage) {
    return NextResponse.json({ error: 'Партія ще не запущена в етап' }, { status: 400 });
  }

  const { data: tasks, error: tasksError } = await loadTasks(batchId);
  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  const currentTask = groupLatestTask((tasks || []) as TaskRow[], currentStage.id);
  if (!currentTask || currentTask.status !== 'completed') {
    return NextResponse.json({ error: 'Поточний етап ще не завершено' }, { status: 400 });
  }

  const currentIndex = orderedStages.findIndex((stage) => stage.id === currentStage.id);
  const nextStage = currentIndex >= 0 ? orderedStages[currentIndex + 1] || null : null;
  if (!nextStage) {
    return NextResponse.json({ error: 'Це останній етап партії' }, { status: 400 });
  }

  const activeNextTask = (tasks || []).find((task) => task.stage_id === nextStage.id && ['pending', 'accepted', 'in_progress'].includes(task.status));
  if (activeNextTask) {
    return NextResponse.json({ error: 'Наступний етап уже створено або запущено' }, { status: 400 });
  }

  const { data: nextTask, error: insertError } = await supabase
    .from('batch_tasks')
    .insert({
      batch_id: batchId,
      stage_id: nextStage.id,
      task_type: nextStage.code,
      assigned_role: nextStage.assigned_role,
      status: 'pending',
      launched_by_user_id: auth.userId,
      launched_at: new Date().toISOString(),
    })
    .select(`
      id, batch_id, stage_id, task_type, assigned_role, status,
      launched_by_user_id, launched_at, notes, created_at, updated_at,
      production_stages!batch_tasks_stage_id_fkey(
        id, code, name, assigned_role, sequence_order, color, is_active
      )
    `)
    .single();

  if (insertError || !nextTask) {
    return NextResponse.json({ error: insertError?.message || 'Не вдалося створити завдання наступного етапу' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: updatedBatch, error: updateError } = await supabase
    .from('production_batches')
    .update({
      status: nextStage.code,
      updated_at: now,
    })
    .eq('id', batchId)
    .select('id, batch_number, status, quantity, actual_start_date, updated_at')
    .single();

  if (updateError || !updatedBatch) {
    await supabase.from('batch_tasks').delete().eq('id', nextTask.id);
    return NextResponse.json({ error: updateError?.message || 'Не вдалося оновити статус партії' }, { status: 500 });
  }

  try {
    const { recordAuditLog } = await import('@/lib/audit');
    await recordAuditLog({
      action: 'UPDATE',
      entityType: 'batch',
      entityId: String(batchId),
      oldData: batch,
      newData: {
        ...updatedBatch,
        previous_stage_id: currentStage.id,
        previous_stage_code: currentStage.code,
        next_stage_id: nextStage.id,
        next_stage_code: nextStage.code,
        next_task_id: nextTask.id,
      },
      request,
      auth: { id: auth.userId, username: auth.username },
    });
  } catch (auditError) {
    console.error('Batch stage advance audit error:', auditError);
  }

  return NextResponse.json({
    batch: updatedBatch,
    current_stage: currentStage,
    next_stage: nextStage,
    task: nextTask,
  });
}
