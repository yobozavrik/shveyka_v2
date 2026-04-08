import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

const ALLOWED_ROLES = ['admin', 'manager', 'master'];

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

async function loadOrderWithLines(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  id: string
) {
  const { data: order, error } = await supabase
    .from('production_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !order) {
    return { order: null, error };
  }

  const { data: lines, error: linesError } = await supabase
    .from('production_order_lines')
    .select('*')
    .eq('order_id', order.id);

  return {
    order: {
      ...order,
      lines: Array.isArray(lines) ? lines : [],
    },
    error: linesError || null,
  };
}

async function recordEvent(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  payload: {
    orderId: number;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    stageLabel?: string | null;
    note?: string | null;
    data?: Record<string, any>;
    createdBy?: number | null;
  }
) {
  const { error } = await supabase.rpc('log_production_order_event', {
    p_order_id: payload.orderId,
    p_action: payload.action,
    p_from_status: payload.fromStatus || null,
    p_to_status: payload.toStatus || null,
    p_stage_label: payload.stageLabel || null,
    p_note: payload.note || null,
    p_payload: payload.data || {},
    p_created_by: payload.createdBy || null,
  });

  if (error) {
    console.warn('[ProductionOrder] Event log failed:', error.message);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string; id: string }> }
) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Р”РѕСЃС‚СѓРї Р·Р°Р±РѕСЂРѕРЅРµРЅРѕ' }, { status: 403 });
  }

  const { action, id } = await params;
  const orderId = parseInt(id, 10);
  const supabase = await createServerClient(true);
  const body = await request.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note.trim() : null;

  if (action === 'approve') {
    const { data: currentOrder } = await supabase
      .from('production_orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('production_orders')
      .update({
        status: 'approved',
        approved_by: auth.userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordEvent(supabase, {
      orderId,
      action: 'approve',
      fromStatus: currentOrder?.status || null,
      toStatus: 'approved',
      stageLabel: 'approval',
      note,
      data: { approved_by: auth.userId },
      createdBy: auth.userId,
    });

    return NextResponse.json(data);
  }

  if (action === 'material_check') {
    const { order, error: orderError } = await loadOrderWithLines(supabase, id);

    if (orderError || !order) {
      return NextResponse.json({ error: 'Р—Р°РјРѕРІР»РµРЅРЅСЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ' }, { status: 404 });
    }

    const { error: calcError } = await supabase.rpc('calculate_material_requirements', {
      p_order_id: orderId,
    });

    if (calcError) {
      return NextResponse.json({ error: calcError.message }, { status: 500 });
    }

    const { data: shortages } = await supabase
      .from('production_order_materials')
      .select('material_name, required_quantity, available_quantity, shortage_quantity')
      .eq('order_id', orderId)
      .gt('shortage_quantity', 0);

    const { data: updated, error: updateError } = await supabase
      .from('production_orders')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await recordEvent(supabase, {
      orderId,
      action: 'material_check',
      fromStatus: order.status,
      toStatus: order.status,
      stageLabel: 'materials_review',
      note,
      data: { shortage_count: shortages?.length || 0 },
      createdBy: auth.userId,
    });

    return NextResponse.json({
      ...updated,
      shortages: shortages || [],
    });
  }

  if (action === 'launch') {
    const { order, error: orderError } = await loadOrderWithLines(supabase, id);

    if (orderError || !order) {
      return NextResponse.json({ error: 'Р—Р°РјРѕРІР»РµРЅРЅСЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ' }, { status: 404 });
    }

    if (order.status !== 'approved') {
      return NextResponse.json(
        {
          error: `Р—Р°РїСѓСЃС‚РёС‚Рё РјРѕР¶РЅР° С‚С–Р»СЊРєРё Р·Р°С‚РІРµСЂРґР¶РµРЅРµ Р·Р°РјРѕРІР»РµРЅРЅСЏ. РџРѕС‚РѕС‡РЅРёР№ СЃС‚Р°С‚СѓСЃ: "${order.status}"`,
        },
        { status: 400 }
      );
    }

    await supabase.rpc('calculate_material_requirements', {
      p_order_id: orderId,
    });

    const { data: shortages, error: shortageError } = await supabase
      .from('production_order_materials')
      .select('material_name, required_quantity, available_quantity, shortage_quantity')
      .eq('order_id', orderId)
      .gt('shortage_quantity', 0);

    if (shortageError) {
      return NextResponse.json({ error: shortageError.message }, { status: 500 });
    }

    if (shortages && shortages.length > 0) {
      // TODO: В будущем (когда будет складской модуль) сделать здесь жесткую блокировку 
      // или механизм резервирования. Пока разрешаем уходить в минус.
      console.warn('[ProductionOrder] Launching order with material shortages:', shortages.length);
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('production_orders')
      .update({
        status: 'launched',
        launched_by: auth.userId,
        launched_at: new Date().toISOString(),
        actual_start_date: todayIsoDate(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await recordEvent(supabase, {
      orderId,
      action: 'launch',
      fromStatus: order.status,
      toStatus: 'launched',
      stageLabel: 'production_launch',
      note,
      data: { batches_created: 0, manual_batches_required: (order.lines || []).length },
      createdBy: auth.userId,
    });

    return NextResponse.json({
      ...updatedOrder,
      batches_created: 0,
      manual_batches_required: (order.lines || []).length,
    });
  }

  if (action === 'cancel-launch' || action === 'cancel_launch') {
    const { order, error: orderError } = await loadOrderWithLines(supabase, id);

    if (orderError || !order) {
      return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
    }

    if (order.status !== 'launched') {
      return NextResponse.json(
        { error: `Скасувати запуск можна лише для замовлення зі статусом "launched". Поточний статус: "${order.status}"` },
        { status: 400 }
      );
    }

    const { data: batches, error: batchesError } = await supabase
      .from('production_batches')
      .select('id, batch_number, status')
      .eq('order_id', orderId);

    if (batchesError) {
      return NextResponse.json({ error: batchesError.message }, { status: 500 });
    }

    const blockingBatches = (batches || []).filter(
      (batch) => batch.status !== 'created'
    );

    if (blockingBatches.length > 0) {
      return NextResponse.json(
        {
          error: 'Скасувати запуск неможливо: частина партій уже в роботі',
          pending_batches: blockingBatches,
        },
        { status: 400 }
      );
    }

    const { data: revertedOrder, error: revertError } = await supabase
      .from('production_orders')
      .update({
        status: 'approved',
        launched_by: null,
        launched_at: null,
        actual_start_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (revertError) {
      return NextResponse.json({ error: revertError.message }, { status: 500 });
    }

    await recordEvent(supabase, {
      orderId,
      action: 'cancel-launch',
      fromStatus: 'launched',
      toStatus: 'approved',
      stageLabel: 'launch_cancelled',
      note,
      data: {
        retained_batches: (batches || []).length,
      },
      createdBy: auth.userId,
    });

    return NextResponse.json({
      ...revertedOrder,
      retained_batches: (batches || []).length,
    });
  }

  if (action === 'complete') {
    const { order, error: orderError } = await loadOrderWithLines(supabase, id);

    if (orderError || !order) {
      return NextResponse.json({ error: 'Р—Р°РјРѕРІР»РµРЅРЅСЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ' }, { status: 404 });
    }

    if (!['launched', 'in_production'].includes(order.status)) {
      return NextResponse.json(
        {
          error: `Р—Р°РІРµСЂС€РёС‚Рё РјРѕР¶РЅР° С‚С–Р»СЊРєРё Р·Р°РїСѓС‰РµРЅРµ Р·Р°РјРѕРІР»РµРЅРЅСЏ. РџРѕС‚РѕС‡РЅРёР№ СЃС‚Р°С‚СѓСЃ: "${order.status}"`,
        },
        { status: 400 }
      );
    }

    const { data: batches, error: batchesError } = await supabase
      .from('production_batches')
      .select('id, batch_number, status')
      .eq('order_id', orderId);

    if (batchesError) {
      return NextResponse.json({ error: batchesError.message }, { status: 500 });
    }

    const blockingBatches = (batches || []).filter(
      (batch) => !['ready', 'closed', 'shipped'].includes(batch.status)
    );

    if (blockingBatches.length > 0) {
      return NextResponse.json(
        {
          error: 'РќРµРјРѕР¶Р»РёРІРѕ Р·Р°РІРµСЂС€РёС‚Рё Р·Р°РјРѕРІР»РµРЅРЅСЏ: РЅРµ РІСЃС– РїР°СЂС‚С–С— РіРѕС‚РѕРІС–',
          pending_batches: blockingBatches,
        },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error: completeError } = await supabase
      .from('production_orders')
      .update({
        status: 'completed',
        completed_by: auth.userId,
        completed_at: new Date().toISOString(),
        actual_completion_date: todayIsoDate(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (completeError) {
      return NextResponse.json({ error: completeError.message }, { status: 500 });
    }

    await recordEvent(supabase, {
      orderId,
      action: 'complete',
      fromStatus: order.status,
      toStatus: 'completed',
      stageLabel: 'production_complete',
      note,
      data: {
        blocking_batches: blockingBatches.length,
      },
      createdBy: auth.userId,
    });

    return NextResponse.json(updatedOrder);
  }

  if (action === 'transfer_to_warehouse') {
    const { order, error: orderError } = await loadOrderWithLines(supabase, id);

    if (orderError || !order) {
      return NextResponse.json({ error: 'Р—Р°РјРѕРІР»РµРЅРЅСЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ' }, { status: 404 });
    }

    if (order.status !== 'completed') {
      return NextResponse.json(
        {
          error: `РџРµСЂРµРґР°С‚Рё РЅР° СЃРєР»Р°Рґ РјРѕР¶РЅР° С‚С–Р»СЊРєРё РїС–СЃР»СЏ Р·Р°РІРµСЂС€РµРЅРЅСЏ Р·Р°РјРѕРІР»РµРЅРЅСЏ. РџРѕС‚РѕС‡РЅРёР№ СЃС‚Р°С‚СѓСЃ: "${order.status}"`,
        },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error: transferError } = await supabase
      .from('production_orders')
      .update({
        status: 'warehouse_transferred',
        warehouse_transferred_by: auth.userId,
        warehouse_transferred_at: new Date().toISOString(),
        warehouse_transfer_notes: note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (transferError) {
      return NextResponse.json({ error: transferError.message }, { status: 500 });
    }

    await recordEvent(supabase, {
      orderId,
      action: 'transfer_to_warehouse',
      fromStatus: order.status,
      toStatus: 'warehouse_transferred',
      stageLabel: 'warehouse_transfer',
      note,
      data: {
        warehouse_transferred_by: auth.userId,
      },
      createdBy: auth.userId,
    });

    return NextResponse.json(updatedOrder);
  }

  if (action === 'close') {
    const { order, error: orderError } = await loadOrderWithLines(supabase, id);

    if (orderError || !order) {
      return NextResponse.json({ error: 'Р—Р°РјРѕРІР»РµРЅРЅСЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ' }, { status: 404 });
    }

    if (order.status !== 'warehouse_transferred') {
      return NextResponse.json(
        {
          error: `Р—Р°РєСЂРёС‚Рё РјРѕР¶РЅР° С‚С–Р»СЊРєРё РїС–СЃР»СЏ РїРµСЂРµРґР°С‡С– РЅР° СЃРєР»Р°Рґ. РџРѕС‚РѕС‡РЅРёР№ СЃС‚Р°С‚СѓСЃ: "${order.status}"`,
        },
        { status: 400 }
      );
    }

    const { data: closedOrder, error: closeError } = await supabase
      .from('production_orders')
      .update({
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (closeError) {
      return NextResponse.json({ error: closeError.message }, { status: 500 });
    }

    await recordEvent(supabase, {
      orderId,
      action: 'close',
      fromStatus: order.status,
      toStatus: 'closed',
      stageLabel: 'archive',
      note,
      createdBy: auth.userId,
    });

    return NextResponse.json(closedOrder);
  }

  if (action === 'cancel') {
    const { order, error: orderError } = await loadOrderWithLines(supabase, id);

    if (orderError || !order) {
      return NextResponse.json({ error: 'Р—Р°РјРѕРІР»РµРЅРЅСЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ' }, { status: 404 });
    }

    if (!['draft', 'approved'].includes(order.status)) {
      return NextResponse.json(
        {
          error: `РЎРєР°СЃСѓРІР°С‚Рё РјРѕР¶РЅР° С‚С–Р»СЊРєРё С‡РµСЂРЅРµС‚РєСѓ Р°Р±Рѕ Р·Р°С‚РІРµСЂРґР¶РµРЅРµ Р·Р°РјРѕРІР»РµРЅРЅСЏ. РџРѕС‚РѕС‡РЅРёР№ СЃС‚Р°С‚СѓСЃ: "${order.status}"`,
        },
        { status: 400 }
      );
    }

    const { data: cancelledOrder, error: cancelError } = await supabase
      .from('production_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (cancelError) {
      return NextResponse.json({ error: cancelError.message }, { status: 500 });
    }

    await recordEvent(supabase, {
      orderId,
      action: 'cancel',
      fromStatus: order.status,
      toStatus: 'cancelled',
      stageLabel: 'cancelled',
      note,
      createdBy: auth.userId,
    });

    return NextResponse.json(cancelledOrder);
  }

  return NextResponse.json({ error: 'РќРµРІС–РґРѕРјР° РґС–СЏ' }, { status: 400 });
}
