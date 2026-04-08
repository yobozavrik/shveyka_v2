import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerClient(true);

  const { data, error } = await supabase
    .from('production_batches')
    .select('*, product_models(id, name, sku, sizes)')
    .eq('id', parseInt(id, 10))
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Не знайдено' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'master'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const batchId = parseInt(id, 10);
  const supabase = await createServerClient(true);
  const body = await req.json().catch(() => ({}));

  const { data: currentBatch, error: currentError } = await supabase
    .from('production_batches')
    .select('status')
    .eq('id', batchId)
    .single();

  if (currentError || !currentBatch) {
    return NextResponse.json({ error: 'Не знайдено' }, { status: 404 });
  }

  if (currentBatch.status !== 'created') {
    return NextResponse.json(
      { error: 'Партію можна редагувати лише до початку наступного етапу' },
      { status: 400 }
    );
  }

  const allowed = [
    'batch_number',
    'product_model_id',
    'quantity',
    'status',
    'sku',
    'notes',
    'priority',
    'fabric_type',
    'fabric_color',
    'thread_number',
    'embroidery_type',
    'embroidery_color',
    'nastyl_number',
    'supervisor_id',
    'planned_start_date',
    'planned_end_date',
    'is_urgent',
    'size_variants',
  ];

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { data: oldData } = await supabase.from('production_batches').select('*').eq('id', batchId).single();

  const { data, error } = await supabase
    .from('production_batches')
    .update(update)
    .eq('id', batchId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { recordAuditLog } = await import('@/lib/audit');
  recordAuditLog({
    action: 'UPDATE',
    entityType: 'batch',
    entityId: id,
    oldData,
    newData: data,
    request: req,
    auth: { id: auth.userId, username: auth.username },
  });

  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'master'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const batchId = parseInt(id, 10);
  const supabase = await createServerClient(true);

  const { data: batch, error: batchError } = await supabase
    .from('production_batches')
    .select('status')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Не знайдено' }, { status: 404 });
  }

  if (batch.status !== 'created') {
    return NextResponse.json(
      { error: 'Партію можна видаляти лише до початку наступного етапу' },
      { status: 400 }
    );
  }

  const { data: oldData } = await supabase.from('production_batches').select('*').eq('id', batchId).single();

  const { error: depError } = await supabase
    .from('operation_entries')
    .delete()
    .eq('production_batch_id', batchId);

  if (depError) {
    return NextResponse.json(
      { error: 'Помилка видалення записів операцій: ' + depError.message },
      { status: 500 }
    );
  }

  const { error } = await supabase.from('production_batches').delete().eq('id', batchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { recordAuditLog } = await import('@/lib/audit');
  recordAuditLog({
    action: 'DELETE',
    entityType: 'batch',
    entityId: id,
    oldData,
    request: _req,
    auth: { id: auth.userId, username: auth.username },
  });

  return NextResponse.json({ success: true });
}
