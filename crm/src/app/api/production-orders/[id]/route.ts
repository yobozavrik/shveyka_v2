import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

const ALLOWED_ROLES = ['admin', 'manager', 'master'];

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const supabase = await createServerClient();

    const { data: order, error } = await supabase
      .from('production_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: baseModel } = await supabase
      .from('base_models')
      .select('name')
      .eq('id', order.base_model_id)
      .maybeSingle();

    const { data: batches } = await supabase
      .from('production_batches')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    const { count: totalLines } = await supabase
      .from('production_order_lines')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId);

    return NextResponse.json({
      ...order,
      base_models: baseModel || null,
      batches: batches || [],
      total_lines: totalLines || 0,
    });
  } catch (error) {
    console.error('Get Order Detailed Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) {
      return ApiResponse.error('Invalid order ID', ERROR_CODES.BAD_REQUEST, 400);
    }

    const body = await request.json().catch(() => ({}));
    const planned_completion_date =
      typeof body?.planned_completion_date === 'string' && body.planned_completion_date
        ? body.planned_completion_date
        : null;
    const priority =
      typeof body?.priority === 'string' && body.priority.trim()
        ? body.priority.trim()
        : null;
    const notes =
      typeof body?.notes === 'string'
        ? body.notes.trim() || null
        : null;

    const supabase = await createServerClient(true);

    const { data: before } = await supabase
      .from('production_orders')
      .select('status, planned_completion_date, priority, notes')
      .eq('id', orderId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('production_orders')
      .update({
        planned_completion_date,
        priority,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return ApiResponse.handle(error, 'production_orders_update');
    }

    await supabase.rpc('log_production_order_event', {
      p_order_id: orderId,
      p_action: 'edit_order',
      p_from_status: before?.status || data.status || null,
      p_to_status: data.status || null,
      p_stage_label: 'editing',
      p_note: null,
      p_payload: {
        planned_completion_date: { from: before?.planned_completion_date || null, to: planned_completion_date },
        priority: { from: before?.priority || null, to: priority },
        notes: { from: before?.notes || null, to: notes },
      },
      p_created_by: auth.userId,
    });

    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'production_orders_update');
  }
}

export async function DELETE() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 405 });
}
