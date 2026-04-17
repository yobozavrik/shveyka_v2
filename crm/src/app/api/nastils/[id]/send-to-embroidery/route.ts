import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const entryId = Number(id);
    if (!Number.isFinite(entryId)) return ApiResponse.error('Invalid entry id', ERROR_CODES.BAD_REQUEST, 400);

    const body = await request.json().catch(() => ({}));
    const batchId = Number(body.batch_id);
    if (!Number.isFinite(batchId)) return ApiResponse.error('Invalid batch_id', ERROR_CODES.BAD_REQUEST, 400);

    const supabase = await createServerClient(true);

    const { data: entry, error: entryError } = await supabase
      .from('task_entries')
      .select('id, data, batch_id')
      .eq('id', entryId)
      .single();

    if (entryError || !entry) return ApiResponse.error('Entry not found', ERROR_CODES.NOT_FOUND, 404);

    const mergedData = {
      ...(entry.data || {}),
      embroidery_sent: true,
      embroidery_sent_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('task_entries')
      .update({ data: mergedData, updated_at: new Date().toISOString() })
      .eq('id', entryId);

    if (updateError) return ApiResponse.handle(updateError, 'nastils_send_to_embroidery');

    const { data: stage, error: stageError } = await supabase
      .from('production_stages')
      .select('id, assigned_role')
      .eq('code', 'embroidery')
      .maybeSingle();

    if (stageError) return ApiResponse.handle(stageError, 'nastils_send_to_embroidery');
    if (!stage) return ApiResponse.success({ success: true, task_created: false });

    const { data: existingTask, error: taskFetchError } = await supabase
      .from('batch_tasks')
      .select('id, status')
      .eq('batch_id', batchId)
      .eq('stage_id', stage.id)
      .not('status', 'in', '(cancelled,completed)')
      .maybeSingle();

    if (taskFetchError) return ApiResponse.handle(taskFetchError, 'nastils_send_to_embroidery');

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
        });

      if (createError) return ApiResponse.handle(createError, 'nastils_send_to_embroidery');
    }

    return ApiResponse.success({ success: true, task_created: !existingTask });
  } catch (error) {
    return ApiResponse.handle(error, 'nastils_send_to_embroidery');
  }
}
