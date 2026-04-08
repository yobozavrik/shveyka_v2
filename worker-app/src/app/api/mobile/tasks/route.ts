import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

const ACTIVE_TASK_STATUSES = ['pending', 'accepted', 'in_progress'];

type TaskRow = {
  id: number;
  batch_id: number;
  stage_id: number;
  task_type: string;
  assigned_role: string;
  status: string;
  accepted_by_employee_id: number | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  launched_by_user_id: number | null;
  launched_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type StageRow = {
  id: number;
  code: string;
  name: string;
  assigned_role: string;
  sequence_order: number;
  color: string | null;
  is_active: boolean;
};

type BatchRow = {
  id: number;
  batch_number: string;
  status: string;
  quantity: number;
  is_urgent: boolean;
  priority: string;
  fabric_type: string | null;
  fabric_color: string | null;
  size_variants: Record<string, any> | null;
  notes: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  product_models: { id: number; name: string; sku: string | null } | Array<{ id: number; name: string; sku: string | null }> | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (user.role || '').toLowerCase();
  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!user.employeeId) {
    return NextResponse.json({ error: 'Employee binding missing' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin('shveyka');

  const { data: tasks, error } = await supabase
    .from('batch_tasks')
    .select(`
      id, batch_id, stage_id, task_type, assigned_role, status,
      accepted_by_employee_id, accepted_at, completed_at, cancelled_at,
      launched_by_user_id, launched_at, notes, created_at, updated_at
    `)
    .in('status', ACTIVE_TASK_STATUSES)
    .order('launched_at', { ascending: false });

  if (error) {
    console.error('Tasks fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const taskRows = (tasks || []) as TaskRow[];
  const taskIds = taskRows.map((task) => task.id);
  const batchIds = Array.from(new Set(taskRows.map((task) => task.batch_id).filter(Boolean)));
  const stageIds = Array.from(new Set(taskRows.map((task) => task.stage_id).filter(Boolean)));

  const [{ data: batches, error: batchesError }, { data: stages, error: stagesError }] = await Promise.all([
    batchIds.length > 0
      ? supabase
          .from('production_batches')
          .select('id, batch_number, status, quantity, is_urgent, priority, fabric_type, fabric_color, size_variants, notes, planned_start_date, planned_end_date, product_models(id, name, sku)')
          .in('id', batchIds)
      : Promise.resolve({ data: [], error: null }),
    stageIds.length > 0
      ? supabase
          .from('production_stages')
          .select('id, code, name, assigned_role, sequence_order, color, is_active')
          .in('id', stageIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (batchesError) {
    console.error('Tasks batch lookup error:', batchesError);
    return NextResponse.json({ error: batchesError.message }, { status: 500 });
  }

  if (stagesError) {
    console.error('Tasks stage lookup error:', stagesError);
    return NextResponse.json({ error: stagesError.message }, { status: 500 });
  }

  const batchMap = new Map<number, BatchRow>();
  for (const batch of (batches || []) as BatchRow[]) {
    batchMap.set(batch.id, batch);
  }

  const stageMap = new Map<number, StageRow>();
  for (const stage of (stages || []) as StageRow[]) {
    stageMap.set(stage.id, stage);
  }

  const visibleTasks = taskRows.filter((task: any) => {
    const stage = stageMap.get(task.stage_id);
    const stageRole = stage?.assigned_role || task.assigned_role;
    if (stageRole !== role) return false;
    if (task.status === 'pending') return true;
    return task.accepted_by_employee_id === user.employeeId;
  });

  const rollsByTask: Record<number, { rolls: number; quantity: number }> = {};

  if (taskIds.length > 0) {
    const { data: nastils, error: nastilsError } = await supabase
      .from('cutting_nastils')
      .select('task_id, quantity_per_nastil')
      .in('task_id', taskIds);

    if (nastilsError) {
      console.error('Task nastils summary error:', nastilsError);
      return NextResponse.json({ error: nastilsError.message }, { status: 500 });
    }

    for (const row of nastils || []) {
      if (!row.task_id) continue;
      if (!rollsByTask[row.task_id]) {
        rollsByTask[row.task_id] = { rolls: 0, quantity: 0 };
      }
      rollsByTask[row.task_id].rolls += 1;
      rollsByTask[row.task_id].quantity += Number(row.quantity_per_nastil || 0);
    }
  }

  const payload = visibleTasks.map((task: TaskRow) => ({
    ...task,
    summary: rollsByTask[task.id] || { rolls: 0, quantity: 0 },
    batch: firstRelation(batchMap.get(task.batch_id) || null),
    stage: stageMap.get(task.stage_id) || null,
  }));

  return NextResponse.json(payload);
}
