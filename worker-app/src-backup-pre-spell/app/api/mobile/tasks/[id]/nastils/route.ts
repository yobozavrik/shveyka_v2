import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

const CUTTING_ROLE = 'cutting';

type Params = { params: Promise<{ id: string }> };

const NastilSchema = z.object({
  nastil_number: z.string().min(1),
  reel_width_cm: z.coerce.number().int().positive(),
  reel_length_m: z.coerce.number().positive(),
  fabric_color: z.string().min(1),
  weight_kg: z.coerce.number().min(0),
  quantity_per_nastil: z.coerce.number().int().positive(),
  remainder_kg: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
});

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

function getTaskStageRole(task: any) {
  const stageRelation = task?.production_stages;
  if (Array.isArray(stageRelation)) {
    return stageRelation[0]?.assigned_role || task?.assigned_role;
  }

  return stageRelation?.assigned_role || task?.assigned_role;
}

export async function GET(request: Request, { params }: Params) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (user.role || '').toLowerCase();
  if (role !== CUTTING_ROLE || !user.employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin('shveyka');
  const { data: task, error: taskError } = await loadTask(taskId);
  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
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

  if (task.status !== 'pending' && task.accepted_by_employee_id !== user.employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('cutting_nastils')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(
  request: Request,
  { params }: Params
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (user.role || '').toLowerCase();
  if (role !== CUTTING_ROLE || !user.employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
  }

  const parsed = NastilSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin('shveyka');
  const { data: task, error: taskError } = await loadTask(taskId);
  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
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

  if (task.status !== 'pending' && task.accepted_by_employee_id !== user.employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['accepted', 'in_progress'].includes(task.status)) {
    return NextResponse.json({ error: 'Task must be accepted before adding nastils' }, { status: 400 });
  }

  const availableColors = parseFabricColors(batch?.fabric_color || null);
  if (availableColors.length > 0 && !availableColors.includes(parsed.data.fabric_color)) {
    return NextResponse.json(
      { error: 'Колір тканини має бути з переліку партії' },
      { status: 400 }
    );
  }

  let statusChanged = false;
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

    statusChanged = true;
  }

  const payload = {
    task_id: taskId,
    batch_id: task.batch_id,
    employee_id: user.employeeId,
    nastil_number: parsed.data.nastil_number,
    reel_width_cm: parsed.data.reel_width_cm,
    reel_length_m: parsed.data.reel_length_m,
    fabric_color: parsed.data.fabric_color,
    weight_kg: parsed.data.weight_kg,
    quantity_per_nastil: parsed.data.quantity_per_nastil,
    remainder_kg: parsed.data.remainder_kg,
    nastil_name: parsed.data.nastil_number,
    age_group: 'custom',
    sizes_json: [],
    total_qty: parsed.data.quantity_per_nastil,
    notes: parsed.data.notes || null,
  };

  const { data, error } = await supabase
    .from('cutting_nastils')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if (statusChanged) {
      await supabase
        .from('batch_tasks')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
