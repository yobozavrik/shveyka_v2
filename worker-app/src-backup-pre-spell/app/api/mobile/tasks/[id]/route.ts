import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

function parseFabricColors(value?: string | null) {
  if (!value) return [] as string[];

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const match = part.match(/^(.*?)(?:\s*\((\d+)\))?$/);
      const color = match?.[1]?.trim() || part;
      const rolls = Math.max(1, Number(match?.[2] || 1));
      return Array.from({ length: rolls }, () => color);
    })
    .sort((left, right) => left.localeCompare(right, 'uk'));
}

function normalizeRelation<T extends Record<string, any>>(relation: T | T[] | null | undefined) {
  if (Array.isArray(relation)) return relation[0] || null;
  return relation || null;
}

function sumQuantities(rows: Array<{ quantity: number | null }>) {
  return rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
}

function normalizeEntries(entries: Array<any>) {
  return entries.map((entry) => ({
    ...entry,
    source: 'task_entries' as const,
  }));
}

function normalizeLegacyNastils(nastils: Array<any>) {
  return nastils.map((row, index) => ({
    id: `legacy-${row.id}`,
    task_id: row.task_id,
    batch_id: row.batch_id,
    employee_id: row.employee_id,
    stage_id: null,
    operation_id: null,
    entry_number: index + 1,
    quantity: Number(row.quantity_per_nastil || 0),
    data: {
      nastil_number: row.nastil_number,
      reel_width_cm: row.reel_width_cm,
      reel_length_m: row.reel_length_m,
      fabric_color: row.fabric_color,
      weight_kg: row.weight_kg,
      quantity_per_nastil: row.quantity_per_nastil,
      remainder_kg: row.remainder_kg,
    },
    notes: null,
    recorded_at: row.created_at,
    source: 'legacy_cutting_nastils' as const,
    operation_code: 'nastil',
    operation_name: 'Настил',
  }));
}

async function loadTask(taskId: number) {
  const supabase = getSupabaseAdmin('shveyka');
  return supabase
    .from('batch_tasks')
    .select(`
      id, batch_id, stage_id, task_type, assigned_role, status,
      accepted_by_employee_id, accepted_at, completed_at, cancelled_at,
      launched_by_user_id, launched_at, notes, created_at, updated_at
    `)
    .eq('id', taskId)
    .single();
}

async function loadStage(stageId: number) {
  const supabase = getSupabaseAdmin('shveyka');
  return supabase
    .from('production_stages')
    .select('id, code, name, assigned_role, sequence_order, color, is_active')
    .eq('id', stageId)
    .single();
}

async function loadBatch(batchId: number) {
  const supabase = getSupabaseAdmin('shveyka');
  return supabase
    .from('production_batches')
    .select('id, batch_number, status, quantity, is_urgent, priority, fabric_type, fabric_color, size_variants, notes, planned_start_date, planned_end_date, product_model_id')
    .eq('id', batchId)
    .single();
}

async function loadProductModel(modelId: number) {
  const supabase = getSupabaseAdmin('shveyka');
  return supabase
    .from('product_models')
    .select('id, name, sku')
    .eq('id', modelId)
    .single();
}

async function loadTaskEntries(taskId: number) {
  const supabase = getSupabaseAdmin('shveyka');
  return supabase
    .from('task_entries')
    .select('id, task_id, batch_id, employee_id, stage_id, operation_id, entry_number, quantity, data, notes, recorded_at')
    .eq('task_id', taskId)
    .order('entry_number', { ascending: true });
}

async function loadLegacyNastils(taskId: number) {
  const supabase = getSupabaseAdmin('shveyka');
  return supabase
    .from('cutting_nastils')
    .select('id, task_id, batch_id, employee_id, nastil_number, reel_width_cm, reel_length_m, fabric_color, weight_kg, quantity_per_nastil, remainder_kg, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
}

async function loadStageOperations(stageId: number) {
  const supabase = getSupabaseAdmin('shveyka');
  return supabase
    .from('stage_operations')
    .select('id, stage_id, code, name, field_schema, sort_order, is_active')
    .eq('stage_id', stageId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true });
}

export async function GET(request: Request, { params }: Params) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (user.role || '').toLowerCase();
  if (!role || !user.employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin('shveyka');
  const [{ data: task, error: taskError }, { data: taskEntries, error: entriesError }, { data: legacyNastils, error: nastilsError }] =
    await Promise.all([loadTask(taskId), loadTaskEntries(taskId), loadLegacyNastils(taskId)]);

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const [{ data: stage, error: stageError }, { data: batchRaw, error: batchError }] = await Promise.all([
    task.stage_id ? loadStage(task.stage_id) : Promise.resolve({ data: null, error: null }),
    task.batch_id ? loadBatch(task.batch_id) : Promise.resolve({ data: null, error: null }),
  ]);

  if (stageError) {
    return NextResponse.json({ error: stageError.message }, { status: 500 });
  }

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  const { data: productModel } = batchRaw?.product_model_id
    ? await loadProductModel(batchRaw.product_model_id)
    : { data: null };

  const batch = batchRaw ? { ...batchRaw, product_models: productModel } : null;

  const stageRole = stage?.assigned_role || task.assigned_role;
  if (stageRole !== role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (task.status !== 'pending' && task.accepted_by_employee_id !== user.employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }

  if (nastilsError) {
    return NextResponse.json({ error: nastilsError.message }, { status: 500 });
  }

  const stageOperations = stage?.id ? await loadStageOperations(stage.id) : { data: [], error: null };
  if (stageOperations.error) {
    return NextResponse.json({ error: stageOperations.error.message }, { status: 500 });
  }

  const colors = parseFabricColors(batch?.fabric_color || null);
  const entries = normalizeEntries((taskEntries || []) as Array<any>);
  const legacyEntries = normalizeLegacyNastils((legacyNastils || []) as Array<any>);
  const displayEntries = entries.length > 0 ? entries : legacyEntries;
  const quantityTotal = displayEntries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);

  // For embroidery stage: load nastils that were sent to embroidery for this batch
  let embroideryNastils: Array<any> = [];
  if (stage?.code === 'embroidery' && task.batch_id) {
    const { data: sentNastils } = await supabase
      .from('task_entries')
      .select('id, task_id, batch_id, employee_id, stage_id, operation_id, entry_number, quantity, data, notes, recorded_at')
      .eq('batch_id', task.batch_id)
      .filter('data->>embroidery_sent', 'eq', 'true')
      .order('entry_number', { ascending: true });
    embroideryNastils = (sentNastils || []).map((e) => ({ ...e, source: 'embroidery_queue' as const }));
  }

  return NextResponse.json({
    task: {
      ...task,
      stage,
      batch,
    },
    batch,
    stage: {
      ...stage,
      operations: stageOperations.data || [],
    },
    entries,
    legacy_nastils: legacyNastils || [],
    display_entries: displayEntries,
    embroidery_nastils: embroideryNastils,
    summary: {
      entries: displayEntries.length,
      quantity: quantityTotal,
    },
    available_colors: colors,
  });
}

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (user.role || '').toLowerCase();
  if (!role || !user.employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').toLowerCase();

  const supabase = getSupabaseAdmin('shveyka');
  const { data: task, error: taskError } = await loadTask(taskId);

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const { data: stage, error: stageError } = await (task.stage_id ? loadStage(task.stage_id) : Promise.resolve({ data: null, error: null }));
  if (stageError) {
    return NextResponse.json({ error: stageError.message }, { status: 500 });
  }

  const stageRole = stage?.assigned_role || task.assigned_role;
  if (stageRole !== role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (task.status !== 'pending' && task.accepted_by_employee_id !== user.employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (action === 'accept') {
    if (task.status !== 'pending') {
      return NextResponse.json({ error: 'Task is already taken' }, { status: 400 });
    }

    const { data, error: updateError } = await supabase
      .from('batch_tasks')
      .update({
        status: 'accepted',
        accepted_by_employee_id: user.employeeId,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select(`
        id, batch_id, stage_id, task_type, assigned_role, status,
        accepted_by_employee_id, accepted_at, completed_at, cancelled_at,
        launched_by_user_id, launched_at, notes, created_at, updated_at
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ task: data });
  }

  if (action === 'complete') {
    if (!['accepted', 'in_progress'].includes(task.status)) {
      return NextResponse.json({ error: 'Task cannot be completed in current status' }, { status: 400 });
    }

    const [{ data: entries }, { data: legacyNastils }] = await Promise.all([
      loadTaskEntries(taskId),
      loadLegacyNastils(taskId),
    ]);

    // For embroidery stage, check for sent nastils instead of task entries
    const isEmbroidery = stage?.code === 'embroidery';
    if (isEmbroidery) {
      const { data: sentNastils } = await supabase
        .from('task_entries')
        .select('id')
        .eq('batch_id', task.batch_id)
        .filter('data->>embroidery_sent', 'eq', 'true')
        .limit(1);
      if (!sentNastils || sentNastils.length === 0) {
        return NextResponse.json({ error: 'Немає настилів для вишивки' }, { status: 400 });
      }
    } else {
      const hasWork = (entries && entries.length > 0) || (legacyNastils && legacyNastils.length > 0);
      if (!hasWork) {
        return NextResponse.json({ error: 'Додайте хоча б один запис' }, { status: 400 });
      }
    }

    const { data, error: updateError } = await supabase
      .from('batch_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select(`
        id, batch_id, stage_id, task_type, assigned_role, status,
        accepted_by_employee_id, accepted_at, completed_at, cancelled_at,
        launched_by_user_id, launched_at, notes, created_at, updated_at
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ task: data });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
