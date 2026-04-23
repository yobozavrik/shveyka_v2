import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

interface EntryRow { quantity: number }

const EntrySchema = z.object({
  batch_id: z.number().int().positive(),
  operation_id: z.number().int().positive(),
  quantity: z.number().int().min(0, 'Кількість не може бути від’ємною'),
  defect_quantity: z.number().int().min(0).optional().default(0),
  metric_value: z.number().min(0).optional().default(0),
  size: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  local_id: z.string().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'partially_approved', 'rework', 'defect']).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const batchId = searchParams.get('batch_id');

  const shveykaClient = getSupabaseAdmin('shveyka');

  let query = shveykaClient
    .from('operation_entries')
    .select(`
      id, quantity, size, status, entry_date, entry_time, notes, local_id, created_at,
      operations(id, name, code, operation_type),
      production_batches(id, batch_number)
    `)
    .eq('employee_id', user.employeeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (batchId) query = query.eq('production_batch_id', parseInt(batchId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const json = await request.json();
    const result = EntrySchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json({ 
        error: 'Помилка валідації', 
        details: result.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const { 
      batch_id, 
      operation_id, 
      quantity, 
      defect_quantity = 0,
      metric_value = 0,
      size, 
      notes, 
      local_id 
    } = result.data;
    const shveykaClient = getSupabaseAdmin('shveyka');

    // Offline dedup by local_id
    if (local_id) {
      const { data: existing } = await shveykaClient
        .from('operation_entries')
        .select('id')
        .eq('local_id', local_id)
        .limit(1)
        .single();
        
      if (existing) {
        // --- LIMIT VALIDATION FOR UPDATE ---
        const { data: batchForUpdate } = await shveykaClient
          .from('production_batches')
          .select('route_card_id, quantity')
          .eq('id', batch_id)
          .single();

        if (batchForUpdate?.route_card_id) {
          const { data: rco } = await shveykaClient
            .from('route_card_operations')
            .select('id, sequence_number')
            .eq('route_card_id', batchForUpdate.route_card_id)
            .eq('operation_id', operation_id)
            .single();

          if (rco && rco.sequence_number > 1) {
            const { data: prevRco } = await shveykaClient
              .from('route_card_operations')
              .select('operation_id')
              .eq('route_card_id', batchForUpdate.route_card_id)
              .eq('sequence_number', rco.sequence_number - 1)
              .single();

            if (prevRco) {
              let prevQuery = shveykaClient
                .from('operation_entries')
                .select('quantity')
                .eq('production_batch_id', batch_id)
                .eq('operation_id', prevRco.operation_id)
                .eq('status', 'approved');
              if (size) prevQuery = prevQuery.eq('size', size);
              const { data: prevEntries } = await prevQuery;
              const prevConfirmed = (prevEntries as EntryRow[] || []).reduce((s, e) => s + (e.quantity || 0), 0);

              if (prevConfirmed > 0) {
                let otherQuery = shveykaClient
                  .from('operation_entries')
                  .select('quantity, defect_quantity')
                  .eq('production_batch_id', batch_id)
                  .eq('operation_id', operation_id)
                  .in('status', ['approved', 'submitted'])
                  .neq('id', existing.id);
                if (size) otherQuery = otherQuery.eq('size', size);
                const { data: otherEntries } = await otherQuery;
                const otherTotal = (otherEntries as any[] || []).reduce(
                  (s, e) => s + (e.quantity || 0) + (e.defect_quantity || 0), 0
                );

                if (otherTotal + quantity + defect_quantity > prevConfirmed) {
                  return NextResponse.json({
                    error: `Перевищення ліміту. З попередньої операції надійшло ${prevConfirmed} шт. Доступно: ${prevConfirmed - otherTotal} шт${size ? ` (розмір ${size})` : ''}`
                  }, { status: 422 });
                }
              }
            }
          }
        }

        let batchStatusOnConfirm: string | null = null;
        const { data: updated, error: updateErr } = await shveykaClient
          .from('operation_entries')
          .update({
            quantity,
            defect_quantity,
            metric_value,
            status: result.data.status || 'submitted',
            notes: notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select(`
            id, quantity, size, status, entry_date, created_at, local_id,
            operations(id, name, code),
            production_batches(id, batch_number)
          `)
          .single();
          
        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

        if (updated && result.data.status === 'approved') {
          try {
            const { data: entryDetails } = await shveykaClient
              .from('operation_entries')
              .select(`
                quantity, employee_id, production_batch_id, operation_id,
                operations(base_rate),
                production_batches(route_card_id, quantity)
              `)
              .eq('id', updated.id)
              .single();

            if (entryDetails) {
              let rate = (entryDetails.operations as any)?.base_rate || 0;
              const routeCardId = (entryDetails.production_batches as any)?.route_card_id;
              
              if (routeCardId) {
                const { data: routeOp } = await shveykaClient
                  .from('route_card_operations')
                  .select('custom_rate, batch_status_on_confirm')
                  .eq('route_card_id', routeCardId)
                  .eq('operation_id', entryDetails.operation_id)
                  .maybeSingle();
                
                if (routeOp) {
                  if (routeOp.custom_rate !== null) rate = routeOp.custom_rate;
                  if (routeOp.batch_status_on_confirm) batchStatusOnConfirm = routeOp.batch_status_on_confirm;
                }
              }

              const amount = (entryDetails.quantity || 0) * rate;
              const { data: period } = await shveykaClient
                .from('payroll_periods')
                .select('id')
                .eq('is_closed', false)
                .order('period_start', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (period && amount > 0) {
                const { data: existingAccrual } = await shveykaClient
                  .from('payroll_accruals')
                  .select('id, piecework_amount, piecework_quantity')
                  .eq('payroll_period_id', period.id)
                  .eq('employee_id', entryDetails.employee_id)
                  .maybeSingle();

                if (existingAccrual) {
                  await shveykaClient.from('payroll_accruals').update({
                    piecework_amount: Number(existingAccrual.piecework_amount || 0) + amount,
                    piecework_quantity: (existingAccrual.piecework_quantity || 0) + (entryDetails.quantity || 0),
                    total_amount: Number(existingAccrual.piecework_amount || 0) + amount, 
                    updated_at: new Date().toISOString()
                  }).eq('id', existingAccrual.id);
                } else {
                  await shveykaClient.from('payroll_accruals').insert({
                    payroll_period_id: period.id,
                    employee_id: entryDetails.employee_id,
                    piecework_amount: amount,
                    piecework_quantity: entryDetails.quantity,
                    total_amount: amount,
                  });
                }
              }
            }

            let nextStatus = batchStatusOnConfirm;
            if (!nextStatus) {
              if (operation_id === 7) nextStatus = 'cutting';
              else if (operation_id === 13) nextStatus = 'embroidery';
              else if (operation_id === 9) nextStatus = 'overlock';
              else if (operation_id === 14) nextStatus = 'straight_stitch';
              else if (operation_id === 15) nextStatus = 'flatlock';
              else if (operation_id === 12) {
                const { data: entries } = await shveykaClient
                  .from('operation_entries')
                  .select('quantity')
                  .eq('production_batch_id', batch_id)
                  .eq('operation_id', 12)
                  .eq('status', 'approved');
                const totalPacked = (entries as any[] || []).reduce((s, e) => s + (e.quantity || 0), 0);
                nextStatus = (totalPacked >= (batchForUpdate?.quantity || 0)) ? 'ready' : 'packaging';
              }
            }

            if (nextStatus) {
              await shveykaClient.from('production_batches').update({ 
                status: nextStatus, updated_at: new Date().toISOString() 
              }).eq('id', batch_id);
            }
          } catch (e) { console.warn('Post-confirm logic failed on update:', e); }
        }
        return NextResponse.json(updated);
      }
    }

    const { data: batch } = await shveykaClient
      .from('production_batches')
      .select('route_card_id, quantity')
      .eq('id', batch_id)
      .single();

    if (!batch) return NextResponse.json({ error: 'Партія не знайдена' }, { status: 404 });

    if (batch.route_card_id) {
      const { data: rco } = await shveykaClient
        .from('route_card_operations')
        .select('id, sequence_number')
        .eq('route_card_id', batch.route_card_id)
        .eq('operation_id', operation_id)
        .single();

      if (rco && rco.sequence_number > 1) {
        const { data: prevRco } = await shveykaClient
          .from('route_card_operations')
          .select('operation_id')
          .eq('route_card_id', batch.route_card_id)
          .eq('sequence_number', rco.sequence_number - 1)
          .single();

        if (prevRco) {
          let prevQuery = shveykaClient.from('operation_entries').select('quantity').eq('production_batch_id', batch_id).eq('operation_id', prevRco.operation_id).eq('status', 'approved');
          if (size) prevQuery = prevQuery.eq('size', size);
          const { data: prevEntries } = await prevQuery;
          const prevConfirmed = (prevEntries as EntryRow[] || []).reduce((s, e) => s + (e.quantity || 0), 0);
          if (prevConfirmed === 0) return NextResponse.json({ error: size ? `Попередня операція не підтверджена для розміру ${size}` : 'Попередня операція ще не підтверджена' }, { status: 422 });

          let curQuery = shveykaClient.from('operation_entries').select('quantity').eq('production_batch_id', batch_id).eq('operation_id', operation_id).in('status', ['approved', 'submitted']);
          if (size) curQuery = curQuery.eq('size', size);
          const { data: curEntries } = await curQuery;
          const curTotal = (curEntries as any[] || []).reduce((s, e) => s + (e.quantity || 0) + (e.defect_quantity || 0), 0);
          if (curTotal + quantity + defect_quantity > prevConfirmed) return NextResponse.json({ error: `Перевищення ліміту. Доступно: ${prevConfirmed - curTotal} шт${size ? ` (розмір ${size})` : ''}` }, { status: 422 });
        }
      }
    }

    let batchStatusOnConfirm: string | null = null;
    if (batch?.route_card_id && result.data.status === 'approved') {
      const { data: rcoData } = await shveykaClient.from('route_card_operations').select('batch_status_on_confirm').eq('route_card_id', batch.route_card_id).eq('operation_id', operation_id).single();
      batchStatusOnConfirm = rcoData?.batch_status_on_confirm || null;
    }

    const { data, error } = await shveykaClient
      .from('operation_entries')
      .upsert({
        production_batch_id: batch_id,
        employee_id: user.employeeId,
        operation_id,
        quantity,
        defect_quantity,
        metric_value,
        size: size || null,
        notes: notes || null,
        local_id: local_id || `${batch_id}-${operation_id}-${size}-${user.employeeId}-${Date.now().toString().slice(-4)}`,
        status: result.data.status || 'submitted',
        entry_source: 'mobile',
      }, { onConflict: 'local_id' })
      .select(`
        id, quantity, size, status, entry_date, created_at, local_id,
        operations(id, name, code)
      `)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (data && result.data.status === 'approved') {
      try {
        const { data: entryDetails } = await shveykaClient.from('operation_entries').select(`quantity, employee_id, production_batch_id, operation_id, operations(base_rate), production_batches(route_card_id, quantity, status)`).eq('id', data.id).single();
        if (entryDetails) {
          let rate = (entryDetails.operations as any)?.base_rate || 0;
          const routeCardId = (entryDetails.production_batches as any)?.route_card_id;
          if (routeCardId) {
            const { data: routeOp } = await shveykaClient.from('route_card_operations').select('custom_rate, batch_status_on_confirm').eq('route_card_id', routeCardId).eq('operation_id', entryDetails.operation_id).maybeSingle();
            if (routeOp) {
              if (routeOp.custom_rate !== null) rate = routeOp.custom_rate;
              if (routeOp.batch_status_on_confirm) batchStatusOnConfirm = routeOp.batch_status_on_confirm;
            }
          }
          const amount = (entryDetails.quantity || 0) * rate;
          const { data: period } = await shveykaClient.from('payroll_periods').select('id').eq('is_closed', false).order('period_start', { ascending: false }).limit(1).maybeSingle();
          if (period && amount > 0) {
            const { data: existingAccrual } = await shveykaClient.from('payroll_accruals').select('id, piecework_amount, piecework_quantity').eq('payroll_period_id', period.id).eq('employee_id', entryDetails.employee_id).maybeSingle();
            if (existingAccrual) {
              await shveykaClient.from('payroll_accruals').update({
                piecework_amount: Number(existingAccrual.piecework_amount || 0) + amount,
                piecework_quantity: (existingAccrual.piecework_quantity || 0) + (entryDetails.quantity || 0),
                total_amount: Number(existingAccrual.piecework_amount || 0) + amount, 
                updated_at: new Date().toISOString()
              }).eq('id', existingAccrual.id);
            } else {
              await shveykaClient.from('payroll_accruals').insert({
                payroll_period_id: period.id, employee_id: entryDetails.employee_id, piecework_amount: amount, piecework_quantity: entryDetails.quantity, total_amount: amount,
              });
            }
          }
        }
        const currentStatus = (entryDetails?.production_batches as any)?.status || '';
        let nextStatus = batchStatusOnConfirm;
        if (!nextStatus) {
            if (operation_id === 7) nextStatus = 'cutting';
            else if (operation_id === 13) nextStatus = 'embroidery';
            else if (operation_id === 9) nextStatus = 'overlock';
            else if (operation_id === 14) nextStatus = 'straight_stitch';
            else if (operation_id === 15) nextStatus = 'flatlock';
            else if (operation_id === 12) {
              const { data: entries } = await shveykaClient.from('operation_entries').select('quantity').eq('production_batch_id', batch_id).eq('operation_id', 12).eq('status', 'approved');
              const totalPacked = (entries as any[] || []).reduce((s, e) => s + (e.quantity || 0), 0);
              nextStatus = (totalPacked >= (batch?.quantity || 0)) ? 'ready' : 'packaging';
            }
        }
        if (nextStatus && nextStatus !== currentStatus) {
          await shveykaClient.from('production_batches').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', batch_id);
        }
      } catch (e) { console.warn('Post-confirm logic failed:', e); }
    }

    try {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'CREATE', entityType: 'operation_entry', entityId: data.id.toString(), newData: data, request, auth: { userId: user.userId, username: user.username, employeeId: user.employeeId }
      });
    } catch (auditErr) { console.error('Non-critical audit log failure:', auditErr); }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Entries POST exception:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
