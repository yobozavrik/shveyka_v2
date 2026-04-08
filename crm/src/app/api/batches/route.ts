import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth, getAuth } from '@/lib/auth-server';
import { z } from 'zod';

const BatchSchema = z.object({
  batch_number: z.string().min(1, 'Номер партії обов’язковий'),
  quantity: z.number().int().positive('Кількість має бути додатною'),
  product_model_id: z.number(),
  target_location_id: z.number().optional().nullable(),
  route_card_id: z.number().optional().nullable(),
  supervisor_id: z.number().optional().nullable(),
  status: z.enum(['created', 'cutting', 'embroidery', 'sewing', 'quality_control', 'packaging', 'ready', 'closed', 'shipped', 'cancelled']).default('created'),
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
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
        query = query.in('status', ['created', 'cutting', 'embroidery', 'sewing', 'quality_control', 'packaging', 'ready']);
      } else {
        query = query.eq('status', status);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error fetching batches:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. AGGREGATE PROGRESS DATA
    const batches = data || [];
    const batchIds = batches.map(b => b.id);

    if (batchIds.length > 0) {
      // Get all confirmed entries for these batches
      const { data: entries } = await supabase
        .from('operation_entries')
        .select('production_batch_id, operation_id, quantity')
        .eq('status', 'approved')
        .in('production_batch_id', batchIds);

      // Group by batch and operation
      const progressMap: Record<number, Record<number, number>> = {};
      for (const entry of (entries || [])) {
        const bId = entry.production_batch_id;
        const opId = entry.operation_id;
        if (!progressMap[bId]) progressMap[bId] = {};
        progressMap[bId][opId] = (progressMap[bId][opId] || 0) + entry.quantity;
      }

      // Format response
      const batchesWithProgress = batches.map(b => ({
        ...b,
        operations_progress: progressMap[b.id] || {}
      }));

      return NextResponse.json(batchesWithProgress);
    }

    return NextResponse.json(batches);
  } catch (e: any) {
    console.error('Batches GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(['admin', 'manager', 'technologist']);
    
    const json = await request.json();
    const result = BatchSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({ 
        error: 'Помилка валідації', 
        details: result.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const body = result.data;
    const auth = await getAuth(); // Отримуємо дані користувача для аудиту
    
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
      console.error('Supabase Error creating batch:', error);
      return NextResponse.json({ 
        error: 'Помилка бази даних', 
        message: error.message,
        details: error.details 
      }, { status: 500 });
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

    return NextResponse.json(batchData, { status: 201 });

  } catch (err: any) {
    console.error('Exception in POST /api/batches:', err);
    
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ 
      error: 'Внутрішня помилка сервера', 
      message: err.message 
    }, { status: 500 });
  }
}
