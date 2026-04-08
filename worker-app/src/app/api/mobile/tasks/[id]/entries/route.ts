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

function getTaskStageRole(task: any) {
  const stageRelation = normalizeRelation(task?.production_stages);
  return stageRelation?.assigned_role || task?.assigned_role || null;
}

function getOperationSchema(operation: any): Array<Record<string, any>> {
  const schema = operation?.field_schema;
  return Array.isArray(schema) ? schema : [];
}

function inferQuantity(data: Record<string, any>, operationCode: string) {
  const preferredKeys = [
    'quantity',
    'quantity_done',
    'quantity_cut',
    'quantity_packed',
    'quantity_per_nastil',
  ];

  for (const key of preferredKeys) {
    const value = data[key];
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }

  if (operationCode === 'nastil') {
    const numeric = Number(data.quantity_per_nastil);
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }

  return null;
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
    .select('id, batch_number, status, quantity, is_urgent, priority, fabric_type, fabric_color, size_variants, notes, planned_start_date, planned_end_date, product_models(id, name, sku)')
    .eq('id', batchId)
    .single();
}

async function loadOperation(operationId: number) {
  const supabase = getSupabaseAdmin('shveyka');
  return supabase
    .from('stage_operations')
    .select('id, stage_id, code, name, field_schema, sort_order, is_active')
    .eq('id', operationId)
    .single();
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
  const operationId = Number(body?.operation_id);
  const rawData = body?.data && typeof body.data === 'object' ? body.data : {};
  const notes = typeof body?.notes === 'string'
    ? body.notes.trim()
    : typeof rawData.notes === 'string'
      ? String(rawData.notes).trim()
      : null;

  if (!Number.isFinite(operationId)) {
    return NextResponse.json({ error: 'Invalid operation id' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin('shveyka');
  const [{ data: task, error: taskError }, { data: operation, error: operationError }] =
    await Promise.all([loadTask(taskId), loadOperation(operationId)]);

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (operationError || !operation) {
    return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
  }

  const [{ data: stage, error: stageError }, { data: batch, error: batchError }] = await Promise.all([
    task.stage_id ? loadStage(task.stage_id) : Promise.resolve({ data: null, error: null }),
    task.batch_id ? loadBatch(task.batch_id) : Promise.resolve({ data: null, error: null }),
  ]);

  if (stageError) {
    return NextResponse.json({ error: stageError.message }, { status: 500 });
  }

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  const stageRole = stage?.assigned_role || task.assigned_role;
  if (stageRole !== role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (task.status !== 'accepted' && task.status !== 'in_progress') {
    return NextResponse.json({ error: 'Task must be accepted before adding entries' }, { status: 400 });
  }

  if (operation.stage_id !== task.stage_id) {
    return NextResponse.json({ error: 'Operation does not belong to this stage' }, { status: 400 });
  }

  const fieldSchema = getOperationSchema(operation);
  const data = { ...rawData };
  const batchColors = parseFabricColors(batch?.fabric_color || null);

  for (const field of fieldSchema) {
    if (!field || typeof field !== 'object') continue;
    const key = String(field.key || '').trim();
    if (!key) continue;

    const value = data[key];
    const isEmpty = value === undefined || value === null || value === '';
    if (field.required && isEmpty) {
      return NextResponse.json({ error: `Field "${key}" is required` }, { status: 400 });
    }

    if (field.type === 'select' && field.source === 'batch_colors' && !isEmpty && batchColors.length > 0) {
      if (!batchColors.includes(String(value))) {
        return NextResponse.json({ error: 'Color must belong to the batch palette' }, { status: 400 });
      }
    }
  }

  if (task.status === 'accepted') {
    const { error: statusError } = await supabase
      .from('batch_tasks')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }
  }

  const { data: existingMaxEntry } = await supabase
    .from('task_entries')
    .select('entry_number')
    .eq('task_id', taskId)
    .eq('operation_id', operationId)
    .order('entry_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const entryNumber = Number(existingMaxEntry?.entry_number || 0) + 1;
  const quantity = inferQuantity(data, operation.code);

  const entryPayload = {
    task_id: taskId,
    batch_id: task.batch_id,
    employee_id: user.employeeId,
    stage_id: task.stage_id,
    operation_id: operationId,
    entry_number: entryNumber,
    quantity,
    data,
    notes,
  };

  const { data: insertedEntry, error: entryError } = await supabase
    .from('task_entries')
    .insert(entryPayload)
    .select('*')
    .single();

  if (entryError || !insertedEntry) {
    if (task.status === 'accepted') {
      await supabase
        .from('batch_tasks')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    }

    return NextResponse.json({ error: entryError?.message || 'Failed to save entry' }, { status: 500 });
  }

  let legacyNastil: any = null;
  if (stage?.code === 'cutting' && operation.code === 'nastil') {
    const legacyPayload = {
      task_id: taskId,
      batch_id: task.batch_id,
      employee_id: user.employeeId,
      nastil_number: String(data.nastil_number || ''),
      reel_width_cm: Number(data.reel_width_cm || 0) || null,
      reel_length_m: Number(data.reel_length_m || 0) || null,
      fabric_color: String(data.fabric_color || ''),
      weight_kg: Number(data.weight_kg || 0) || null,
      quantity_per_nastil: Number(data.quantity_per_nastil || 0) || null,
      remainder_kg: Number(data.remainder_kg || 0) || null,
      nastil_name: String(data.nastil_number || ''),
      age_group: 'custom',
      sizes_json: [],
      total_qty: Number(data.quantity_per_nastil || quantity || 0) || 0,
      notes,
    };

    const { data: insertedLegacy, error: legacyError } = await supabase
      .from('cutting_nastils')
      .insert(legacyPayload)
      .select('*')
      .single();

    if (legacyError) {
      console.error('cutting_nastils legacy insert failed:', legacyError);
    } else {
      legacyNastil = insertedLegacy;
    }
  }

  const { error: logError } = await supabase
    .from('employee_activity_log')
    .insert({
      employee_id: user.employeeId,
      task_id: taskId,
      batch_id: task.batch_id,
      batch_number: batch?.batch_number || null,
      stage_code: stage?.code || null,
      stage_name: stage?.name || null,
      action: 'entry_added',
      quantity,
    });

  if (logError) {
    console.error('employee_activity_log insert failed:', logError);
  }

  return NextResponse.json({
    entry: insertedEntry,
    legacy_nastil: legacyNastil,
  });
}
