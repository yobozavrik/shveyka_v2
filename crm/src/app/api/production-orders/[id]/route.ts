import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

type EditableField =
  | 'order_type'
  | 'customer_name'
  | 'customer_phone'
  | 'customer_email'
  | 'target_location_id'
  | 'priority'
  | 'planned_completion_date'
  | 'notes';

type EditableLine = {
  model_id: number | null;
  model_name: string;
  model_sku: string | null;
  size: string | null;
  quantity: number;
  notes: string | null;
};

const ALLOWED_ROLES = ['admin', 'manager', 'master'];

function normalizeJson(value: unknown) {
  return value === undefined ? null : value;
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(normalizeJson(a)) === JSON.stringify(normalizeJson(b));
}

function normalizeLineInput(line: any): EditableLine {
  return {
    model_id:
      line?.model_id === undefined || line?.model_id === null || line?.model_id === ''
        ? null
        : Number(line.model_id),
    model_name: typeof line?.model_name === 'string' ? line.model_name.trim() : '',
    model_sku: typeof line?.model_sku === 'string' ? line.model_sku.trim() || null : null,
    size: typeof line?.size === 'string' ? line.size.trim() || null : null,
    quantity: Number(line?.quantity) || 0,
    notes: typeof line?.notes === 'string' ? line.notes.trim() || null : null,
  };
}

function normalizeDbLine(line: any): EditableLine {
  return {
    model_id: line?.model_id === undefined || line?.model_id === null ? null : Number(line.model_id),
    model_name: typeof line?.model_name === 'string' ? line.model_name : '',
    model_sku: typeof line?.model_sku === 'string' ? line.model_sku : null,
    size: typeof line?.size === 'string' ? line.size : null,
    quantity: Number(line?.quantity) || 0,
    notes: typeof line?.notes === 'string' ? line.notes : null,
  };
}

function sameLines(a: EditableLine[], b: EditableLine[]) {
  return sameValue(a, b);
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const supabase = await createServerClient(true);

  const { data: currentOrder, error: currentError } = await supabase
    .from('production_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (currentError || !currentOrder) {
    return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
  }

  const { data: currentLines, error: currentLinesError } = await supabase
    .from('production_order_lines')
    .select('*')
    .eq('order_id', orderId)
    .order('id', { ascending: true });

  if (currentLinesError) {
    return NextResponse.json({ error: currentLinesError.message }, { status: 500 });
  }

  const nextValues: Partial<Record<EditableField, any>> = {};
  const changes: Array<{ field_name: string; old_value: any; new_value: any }> = [];
  const normalizedCurrentLines = Array.isArray(currentLines) ? currentLines.map(normalizeDbLine) : [];

  const candidateFields: Array<{ key: EditableField; value: any }> = [
    { key: 'order_type', value: body.order_type },
    { key: 'customer_name', value: body.customer_name },
    { key: 'customer_phone', value: body.customer_phone },
    { key: 'customer_email', value: body.customer_email },
    {
      key: 'target_location_id',
      value:
        body.target_location_id === undefined
          ? undefined
          : body.target_location_id === null || body.target_location_id === ''
            ? null
            : Number(body.target_location_id),
    },
    { key: 'priority', value: body.priority },
    {
      key: 'planned_completion_date',
      value: body.planned_completion_date === undefined ? undefined : body.planned_completion_date || null,
    },
    { key: 'notes', value: body.notes === undefined ? undefined : body.notes || null },
  ];

  for (const field of candidateFields) {
    if (field.value === undefined) continue;
    if (sameValue((currentOrder as any)[field.key], field.value)) continue;
    nextValues[field.key] = field.value;
    changes.push({
      field_name: field.key,
      old_value: (currentOrder as any)[field.key] ?? null,
      new_value: field.value ?? null,
    });
  }

  const hasLinesPayload = Array.isArray(body.lines);
  const normalizedNextLines = hasLinesPayload ? body.lines.map(normalizeLineInput) : null;
  const linesChanged = hasLinesPayload && normalizedNextLines ? !sameLines(normalizedCurrentLines, normalizedNextLines) : false;

  if (hasLinesPayload) {
    if (!normalizedNextLines || normalizedNextLines.length === 0) {
      return NextResponse.json({ error: 'Замовлення повинно містити хоча б одну модель' }, { status: 400 });
    }

    for (const line of normalizedNextLines) {
      if (!line.model_name) {
        return NextResponse.json({ error: 'Кожна позиція замовлення повинна мати назву моделі' }, { status: 400 });
      }
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        return NextResponse.json({ error: 'Кількість у позиції має бути додатною' }, { status: 400 });
      }
    }

    if (linesChanged) {
      changes.push({
        field_name: 'production_order_lines',
        old_value: normalizedCurrentLines,
        new_value: normalizedNextLines,
      });
    }
  }

  if (changes.length === 0) {
    return NextResponse.json({ ...currentOrder, changes_logged: 0 });
  }

  const now = new Date().toISOString();

  if (linesChanged && normalizedNextLines) {
    const { error: deleteLinesError } = await supabase
      .from('production_order_lines')
      .delete()
      .eq('order_id', orderId);

    if (deleteLinesError) {
      return NextResponse.json({ error: deleteLinesError.message }, { status: 500 });
    }

    const linesToInsert = normalizedNextLines.map((line) => ({
      order_id: orderId,
      model_id: line.model_id,
      model_name: line.model_name,
      model_sku: line.model_sku,
      size: line.size,
      quantity: line.quantity,
      notes: line.notes,
    }));

    const { error: insertLinesError } = await supabase
      .from('production_order_lines')
      .insert(linesToInsert);

    if (insertLinesError) {
      const restoreLines = normalizedCurrentLines.map((line) => ({
        order_id: orderId,
        model_id: line.model_id,
        model_name: line.model_name,
        model_sku: line.model_sku,
        size: line.size,
        quantity: line.quantity,
        notes: line.notes,
      }));

      if (restoreLines.length > 0) {
        await supabase.from('production_order_lines').insert(restoreLines);
      }

      return NextResponse.json({ error: insertLinesError.message }, { status: 500 });
    }
  }

  const nextTotalQuantity = linesChanged && normalizedNextLines
    ? normalizedNextLines.reduce((sum, line) => sum + line.quantity, 0)
    : Number((currentOrder as any).total_quantity || 0);
  const nextTotalLines = linesChanged && normalizedNextLines
    ? normalizedNextLines.length
    : Number((currentOrder as any).total_lines || 0);

  const { data: updatedOrder, error: updateError } = await supabase
    .from('production_orders')
    .update({
      ...nextValues,
      ...(linesChanged ? { total_quantity: nextTotalQuantity, total_lines: nextTotalLines } : {}),
      updated_at: now,
    })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) {
    if (linesChanged && Array.isArray(currentLines)) {
      await supabase.from('production_order_lines').delete().eq('order_id', orderId);
      const restoreLines = currentLines.map((line: any) => ({
        order_id: orderId,
        model_id: line.model_id ?? null,
        model_name: line.model_name,
        model_sku: line.model_sku ?? null,
        size: line.size ?? null,
        quantity: line.quantity,
        notes: line.notes ?? null,
      }));
      if (restoreLines.length > 0) {
        await supabase.from('production_order_lines').insert(restoreLines);
      }
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  for (const change of changes) {
    const { error: logError } = await supabase.rpc('log_production_order_field_change', {
      p_order_id: orderId,
      p_change_type: change.field_name === 'production_order_lines' ? 'line_replaced' : 'field_change',
      p_field_name: change.field_name,
      p_old_value: change.old_value,
      p_new_value: change.new_value,
      p_note: `Field updated: ${change.field_name}`,
      p_payload: {
        source: 'api.production-orders.patch',
      },
      p_changed_by: auth.userId,
    });

    if (logError) {
      console.warn('[ProductionOrder] Field change log failed:', logError.message);
    }
  }

  return NextResponse.json({
    ...updatedOrder,
    changes_logged: changes.length,
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  const supabase = await createServerClient(true);

  const { data: currentOrder, error: currentError } = await supabase
    .from('production_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (currentError || !currentOrder) {
    return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
  }

  if (!['draft', 'approved'].includes((currentOrder as any).status)) {
    return NextResponse.json({ error: 'Видаляти можна лише чернетки та затверджені замовлення' }, { status: 400 });
  }

  const { data: currentLines, error: linesError } = await supabase
    .from('production_order_lines')
    .select('*')
    .eq('order_id', orderId);

  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 });
  }

  const { error: deleteLinesError } = await supabase
    .from('production_order_lines')
    .delete()
    .eq('order_id', orderId);

  if (deleteLinesError) {
    return NextResponse.json({ error: deleteLinesError.message }, { status: 500 });
  }

  const { error: deleteOrderError } = await supabase
    .from('production_orders')
    .delete()
    .eq('id', orderId);

  if (deleteOrderError) {
    if (Array.isArray(currentLines) && currentLines.length > 0) {
      const restoreLines = currentLines.map((line: any) => ({
        order_id: orderId,
        model_id: line.model_id ?? null,
        model_name: line.model_name,
        model_sku: line.model_sku ?? null,
        size: line.size ?? null,
        quantity: line.quantity,
        notes: line.notes ?? null,
      }));
      await supabase.from('production_order_lines').insert(restoreLines);
    }

    return NextResponse.json({ error: deleteOrderError.message }, { status: 500 });
  }

  try {
    const { recordAuditLog } = await import('@/lib/audit');
    recordAuditLog({
      action: 'DELETE',
      entityType: 'production_order',
      entityId: String(orderId),
      oldData: {
        ...currentOrder,
        lines: currentLines || [],
      },
      request,
      auth: { id: auth.userId, username: auth.username },
    });
  } catch (auditError) {
    console.warn('[ProductionOrder] Audit log failed:', auditError);
  }

  return NextResponse.json({ success: true });
}
