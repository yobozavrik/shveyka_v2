import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

const CUTTING_STAGE_ID = 1; // production_stages.id where code='cutting'
const CUTTING_STAGE_ROLE = 'cutting';

export async function GET(request: Request, { params }: Params) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const batchId = Number(id);
  if (!Number.isFinite(batchId)) {
    return NextResponse.json({ error: 'Invalid batch id' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin('shveyka');

  // 1. Шукаємо існуючу активну задачу розкрою
  const { data: tasks, error: tasksError } = await supabase
    .from('batch_tasks')
    .select('id, batch_id, stage_id, task_type, assigned_role, status, accepted_by_employee_id, accepted_at')
    .eq('batch_id', batchId)
    .in('status', ['pending', 'accepted', 'in_progress'])
    .order('created_at', { ascending: true });

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  const existingTask = (tasks || []).find(
    (t: any) => t.task_type === 'cutting' || t.stage_id === CUTTING_STAGE_ID
  );

  if (existingTask) {
    return NextResponse.json({ task: existingTask });
  }

  // 2. Задачі нема — перевіряємо батч і створюємо задачу
  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('id, status')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Партія не знайдена' }, { status: 404 });
  }

  // Можна запустити тільки якщо батч ще не завершено
  if (!['created', 'cutting'].includes(batch.status)) {
    return NextResponse.json({ task: null });
  }

  // 3. Створюємо нову задачу розкрою
  const { data: newTask, error: insertError } = await supabase
    .from('batch_tasks')
    .insert({
      batch_id: batchId,
      stage_id: CUTTING_STAGE_ID,
      task_type: 'cutting',
      assigned_role: CUTTING_STAGE_ROLE,
      status: 'pending',
      launched_at: new Date().toISOString(),
    })
    .select('id, batch_id, stage_id, task_type, assigned_role, status')
    .single();

  if (insertError || !newTask) {
    return NextResponse.json({ error: insertError?.message || 'Не вдалося створити задачу' }, { status: 500 });
  }

  // 4. Переводимо батч у статус 'cutting' якщо ще 'created'
  if (batch.status === 'created') {
    await supabase
      .from('production_batches')
      .update({ status: 'cutting', actual_start_date: new Date().toISOString().split('T')[0] })
      .eq('id', batchId);
  }

  return NextResponse.json({ task: newTask });
}
