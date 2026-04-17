import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/mobile/notifications/list
 * Returns list of pending tasks with batch info for the current user's role.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (user.role || '').toLowerCase();
  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin('shveyka');

  // Fetch pending tasks for this role
  const { data: tasks, error: tasksError } = await supabase
    .from('batch_tasks')
    .select('id, batch_id, stage_id, task_type, assigned_role, status, created_at')
    .eq('status', 'pending')
    .eq('assigned_role', role)
    .order('created_at', { ascending: false });

  if (tasksError) {
    console.error('Notification list error:', tasksError);
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json([]);
  }

  const batchIds = Array.from(new Set(tasks.map((t: any) => t.batch_id).filter(Boolean)));
  const stageIds = Array.from(new Set(tasks.map((t: any) => t.stage_id).filter(Boolean)));

  // Fetch batch and stage info in parallel
  const [{ data: batches, error: batchesError }, { data: stages, error: stagesError }] =
    await Promise.all([
      batchIds.length > 0
        ? supabase
            .from('production_batches')
            .select('id, batch_number, is_urgent, product_models(id, name, sku)')
            .in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      stageIds.length > 0
        ? supabase
            .from('production_stages')
            .select('id, name, code')
            .in('id', stageIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (batchesError) {
    console.error('Notification list batch lookup error:', batchesError);
    return NextResponse.json({ error: batchesError.message }, { status: 500 });
  }

  if (stagesError) {
    console.error('Notification list stage lookup error:', stagesError);
    return NextResponse.json({ error: stagesError.message }, { status: 500 });
  }

  // Build lookup maps
  const batchMap = new Map<number, any>();
  for (const batch of batches || []) {
    batchMap.set(batch.id, batch);
  }

  const stageMap = new Map<number, any>();
  for (const stage of stages || []) {
    stageMap.set(stage.id, stage);
  }

  // Helper to extract first model from array or object
  function firstModel(val: any) {
    if (!val) return null;
    if (Array.isArray(val)) return val[0] || null;
    return val;
  }

  // Build result list
  const result = tasks.map((task: any) => {
    const batch = batchMap.get(task.batch_id);
    const stage = stageMap.get(task.stage_id);
    const productModel = firstModel(batch?.product_models);

    return {
      task_id: task.id,
      batch_number: batch?.batch_number || `#${task.batch_id}`,
      product_name: productModel?.name || 'Без моделі',
      stage_name: stage?.name || stage?.code || task.task_type,
      is_urgent: batch?.is_urgent || false,
      created_at: task.created_at,
    };
  });

  return NextResponse.json(result);
}
