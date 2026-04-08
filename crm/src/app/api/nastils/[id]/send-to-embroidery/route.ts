import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: 'Invalid entry id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const batchId = Number(body.batch_id);
  if (!Number.isFinite(batchId)) {
    return NextResponse.json({ error: 'Invalid batch_id' }, { status: 400 });
  }

  const supabase = await createServerClient(true);

  // 1. Get nastil entry
  const { data: entry, error: entryError } = await supabase
    .from('task_entries')
    .select('id, data, batch_id')
    .eq('id', entryId)
    .single();

  if (entryError || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  // 2. Mark nastil as sent to embroidery
  const mergedData = {
    ...(entry.data || {}),
    embroidery_sent: true,
    embroidery_sent_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('task_entries')
    .update({ data: mergedData, updated_at: new Date().toISOString() })
    .eq('id', entryId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 3. Find embroidery production stage
  const { data: stage, error: stageError } = await supabase
    .from('production_stages')
    .select('id, assigned_role')
    .eq('code', 'embroidery')
    .maybeSingle();

  if (stageError) {
    return NextResponse.json({ error: stageError.message }, { status: 500 });
  }

  if (!stage) {
    // No embroidery stage configured — still return success (nastil is marked)
    return NextResponse.json({ success: true, task_created: false });
  }

  // 4. Find existing active embroidery batch_task or create one
  const { data: existingTask, error: taskFetchError } = await supabase
    .from('batch_tasks')
    .select('id, status')
    .eq('batch_id', batchId)
    .eq('stage_id', stage.id)
    .not('status', 'in', '(cancelled,completed)')
    .maybeSingle();

  if (taskFetchError) {
    return NextResponse.json({ error: taskFetchError.message }, { status: 500 });
  }

  if (!existingTask) {
    const { error: createError } = await supabase
      .from('batch_tasks')
      .insert({
        batch_id: batchId,
        stage_id: stage.id,
        task_type: 'stage',
        assigned_role: stage.assigned_role,
        status: 'pending',
        launched_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, task_created: !existingTask });
}
