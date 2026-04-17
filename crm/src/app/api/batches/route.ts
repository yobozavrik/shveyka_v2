import { createServerClient } from '@/lib/supabase/server';
import { requireAuth, getAuth } from '@/lib/auth-server';
import { z } from 'zod';
import { appLogger } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

const BatchSchema = z.object({
  batch_number: z.string().min(1, 'Номер партії обов’язковий'),
  quantity: z.number().int().positive('Кількість має бути додатною'),
  product_model_id: z.number(),
  target_location_id: z.number().optional().nullable(),
  route_card_id: z.number().optional().nullable(),
  supervisor_id: z.number().optional().nullable(),
  status: z.enum(['created', 'cutting', 'sewing', 'overlock', 'straight_stitch', 'coverlock', 'packaging', 'ready', 'shipped', 'closed', 'cancelled']).default('created'),
  is_urgent: z.boolean().default(false),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  planned_start_date: z.string().optional().nullable(),
  planned_end_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  size_variants: z.record(z.string(), z.number()).optional().nullable(),
  fabric_type: z.string().optional().nullable(),
  fabric_color: z.string().optional().nullable(),
  thread_number: z.string().optional().nullable(),
  embroidery_type: z.string().optional().nullable(),
  embroidery_color: z.string().optional().nullable(),
  nastyl_number: z.number().optional().nullable(),
  sku: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient(true);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('production_batches')
      .select(`
        id, batch_number, status, quantity, size_variants, is_urgent, priority,
        planned_start_date, planned_end_date, actual_start_date, actual_end_date,
        fabric_type, fabric_color, thread_number, embroidery_type, embroidery_color,
        nastyl_number, notes, created_at, route_card_id, source_order, client_name,
        product_models(id, name, sku, category, thumbnail_url, sizes),
        employees!production_batches_supervisor_id_fkey(id, full_name)
      `)
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.in('status', ['created', 'cutting', 'sewing', 'overlock', 'straight_stitch', 'coverlock', 'packaging', 'ready']);
      } else {
        query = query.eq('status', status);
      }
    }

    const { data, error } = await query;
    if (error) {
      return ApiResponse.handle(error, 'batches_get');
    }

    // 2. PREPARE IDS
    const batches = data || [];
    const batchIds = batches.map(b => b.id);

    // 3. FETCH BATCH TASKS (безопасно)
    let taskMap: Record<number, { status: string, role: string }> = {};
    if (batchIds.length > 0) {
      try {
        const { data: tasks } = await supabase.from('batch_tasks').select('batch_id, status, assigned_role').in('batch_id', batchIds).order('id', { ascending: false });
        for (const t of (tasks || [])) {
          if (!taskMap[t.batch_id]) taskMap[t.batch_id] = { status: t.status, role: t.assigned_role };
        }
      } catch (e) { console.error('Tasks fetch error', e); }
    }

    // 4. AGGREGATE PROGRESS (безопасно)
    let progressMap: Record<number, Record<number, number>> = {};
    if (batchIds.length > 0) {
      try {
        const { data: entries } = await supabase.from('task_entries').select('batch_id, operation_id, quantity').in('batch_id', batchIds);
        for (const entry of (entries || [])) {
          const bId = entry.batch_id;
          const opId = entry.operation_id;
          if (!progressMap[bId]) progressMap[bId] = {};
          progressMap[bId][opId] = (progressMap[bId][opId] || 0) + Number(entry.quantity || 0);
        }
      } catch (e) { console.error('Entries fetch error', e); }
    }

    // 5. FORMAT RESPONSE
    return ApiResponse.success(batches.map(b => ({
      ...b,
      operations_progress: progressMap[b.id] || {},
      task_status: taskMap[b.id]?.status || null,
      task_role: taskMap[b.id]?.role || null
    })));
  } catch (error) {
    return ApiResponse.handle(error, 'batches_get');
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(['admin', 'manager', 'technologist']);

    const json = await request.json();
    const result = BatchSchema.safeParse(json);

    if (!result.success) {
      return ApiResponse.error('Помилка валідації', ERROR_CODES.VALIDATION_ERROR, 400, result.error.flatten().fieldErrors);
    }

    const body = result.data;
    const auth = await getAuth(); // Получаем данные пользователя для лога

    const supabase = await createServerClient(true);
    // 3. Сохраняем в БД
    const { data: batchData, error } = await supabase
      .from('production_batches')
      .insert({
        ...body,
        size_variants: json.size_variants || null, 
      })
      .select(`
        id, batch_number, status, quantity, created_at,
        product_models(id, name, sku, thumbnail_url, sizes)
      `)
      .single();

    if (error) {
      return ApiResponse.handle(error, 'batches_post');
    }

    // 3.1. АВТОМАТИЧЕСКИ создаем первую задачу для Раскроя
    // Логируем создание
    await appLogger({
      level: 'user_action',
      message: `${auth?.username} создал партию ${body.batch_number}`,
      module: 'batches',
      action: 'batch_created',
      userId: auth?.userId?.toString(),
      username: auth?.username,
      data: body
    });

    const { data: cuttingStage } = await supabase
      .from('production_stages')
      .select('id, assigned_role')
      .eq('code', 'cutting')
      .single();

    if (cuttingStage) {
      await supabase.from('batch_tasks').insert({
        batch_id: batchData.id,
        stage_id: cuttingStage.id,
        task_type: 'cutting',
        assigned_role: cuttingStage.assigned_role,
        status: 'pending'
      });
    }

    // 4. Логування аудиту (не блокує основний запит)
    try {
      if (auth) {
        const { recordAuditLog } = await import('@/lib/audit');
        recordAuditLog({
          action: 'CREATE',
          entityType: 'batch',
          entityId: batchData.id.toString(),
          newData: batchData,
          request,
          auth: { id: auth.userId, username: auth.username }
        });
      }
    } catch (auditErr) {
      console.error('Audit Log Error (non-critical):', auditErr);
    }

    return ApiResponse.success(batchData, 201);

  } catch (error) {
    return ApiResponse.handle(error, 'batches_post');
  }
}
