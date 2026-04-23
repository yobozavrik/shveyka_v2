import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const body = await request.json();
    const { entry_id, action, comment: _comment } = body;

    if (!entry_id || !['confirm', 'reject'].includes(action)) {
      return ApiResponse.error('Невірні параметри', ERROR_CODES.BAD_REQUEST, 400);
    }

    const supabase = await createServerClient(true);
    const newStatus = action === 'confirm' ? 'approved' : 'rejected';

    console.log(`[ApproveEntry] Processing id=${entry_id}, action=${action}`);

    // Ensure entry_id is a number if it comes as a string
    const numericId = typeof entry_id === 'string' ? parseInt(entry_id, 10) : entry_id;

    const { data, error } = await supabase
      .from('task_entries')
      .update({ 
        status: newStatus,
        approved_at: new Date().toISOString(),
        approved_by: auth.userId
      })
      .eq('id', numericId)
      .eq('status', 'submitted')
      .select()
      .maybeSingle();

    if (error) {
      return ApiResponse.handle(error, 'entries_approve');
    }

    if (!data) {
      console.warn(`[ApproveEntry] Entry ${entry_id} not found or not in 'submitted' status`);
      return ApiResponse.error('Запис не знайдено або вже підтверджено', ERROR_CODES.NOT_FOUND, 404);
    }

    // --- PAYROLL ACCRUAL LOGIC ---
    if (action === 'confirm' && data) {
      try {
        const { data: entryDetails, error: detailErr } = await supabase
          .from('task_entries')
          .select('quantity, employee_id, batch_id, operation_id')
          .eq('id', numericId)
          .single();

        if (detailErr || !entryDetails) throw new Error(`Could not fetch details: ${detailErr?.message}`);

        // Get operation code from stage_operations to find base_rate in operations
        const { data: stageOp } = await supabase
          .from('stage_operations')
          .select('code')
          .eq('id', entryDetails.operation_id)
          .maybeSingle();

        let rate = 0;
        if (stageOp) {
          const { data: opRow } = await supabase
            .from('operations')
            .select('base_rate, id')
            .eq('code', stageOp.code)
            .maybeSingle();
          
          if (opRow) {
            rate = opRow.base_rate || 0;
          }
        }

        const { data: batchRow } = await supabase
          .from('production_batches')
          .select('route_card_id')
          .eq('id', entryDetails.batch_id)
          .maybeSingle();

        let nextStatus: string | null = null;
        const routeCardId = batchRow?.route_card_id;
        
        if (routeCardId && stageOp) {
          const { data: opRef } = await supabase
            .from('operations')
            .select('id')
            .eq('code', stageOp.code)
            .maybeSingle();

          if (opRef) {
            const { data: routeOp } = await supabase
              .from('route_card_operations')
              .select('custom_rate, batch_status_on_confirm')
              .eq('route_card_id', routeCardId)
              .eq('operation_id', opRef.id)
              .maybeSingle();
            
            if (routeOp) {
              if (routeOp.custom_rate !== null) rate = routeOp.custom_rate;
              if (routeOp.batch_status_on_confirm) nextStatus = routeOp.batch_status_on_confirm;
            }
          }
        }

        const amount = (entryDetails.quantity || 0) * rate;

        const { data: period, error: periodErr } = await supabase
          .from('payroll_periods')
          .select('id')
          .eq('is_closed', false)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (periodErr || !period) {
          console.error('[ApproveEntry] No active payroll period found:', periodErr);
        } else if (amount > 0) {
          const { data: existingAccrual } = await supabase
            .from('payroll_accruals')
            .select('id, piecework_amount, piecework_quantity')
            .eq('payroll_period_id', period.id)
            .eq('employee_id', entryDetails.employee_id)
            .maybeSingle();

          if (existingAccrual) {
            await supabase
              .from('payroll_accruals')
              .update({
                piecework_amount: Number(existingAccrual.piecework_amount || 0) + amount,
                piecework_quantity: (existingAccrual.piecework_quantity || 0) + (entryDetails.quantity || 0),
                total_amount: Number(existingAccrual.piecework_amount || 0) + amount, 
                updated_at: new Date().toISOString()
              })
              .eq('id', existingAccrual.id);
          } else {
            await supabase
              .from('payroll_accruals')
              .insert({
                payroll_period_id: period.id,
                employee_id: entryDetails.employee_id,
                piecework_amount: amount,
                piecework_quantity: entryDetails.quantity,
                total_amount: amount,
                updated_at: new Date().toISOString()
              });
          }
        }

        // 5. AUTO-ADVANCE LOGIC
        const { data: batchInfo } = await supabase
          .from('production_batches')
          .select('id, quantity, status')
          .eq('id', entryDetails.batch_id)
          .single();

        const { data: stageInfo } = await supabase
          .from('production_stages')
          .select('id, code, sequence_order')
          .eq('code', batchInfo?.status)
          .single();

        if (batchInfo && stageInfo) {
          const { data: stageEntries } = await supabase
            .from('task_entries')
            .select('quantity')
            .eq('batch_id', batchInfo.id)
            .eq('stage_id', stageInfo.id)
            .eq('status', 'approved');

          const totalApproved = (stageEntries || []).reduce((sum, e) => sum + (e.quantity || 0), 0);

          if (totalApproved >= batchInfo.quantity) {
            await supabase
              .from('batch_tasks')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('batch_id', batchInfo.id)
              .eq('stage_id', stageInfo.id)
              .in('status', ['pending', 'accepted', 'in_progress']);

            const { data: nextStages } = await supabase
              .from('production_stages')
              .select('id, code, assigned_role')
              .gt('sequence_order', stageInfo.sequence_order)
              .eq('is_active', true)
              .order('sequence_order', { ascending: true })
              .limit(1);

            if (nextStages && nextStages.length > 0) {
              const nextStage = nextStages[0];
              await supabase
                .from('batch_tasks')
                .insert({
                  batch_id: batchInfo.id,
                  stage_id: nextStage.id,
                  task_type: nextStage.code,
                  assigned_role: nextStage.assigned_role,
                  status: 'pending',
                  launched_at: new Date().toISOString()
                });

              await supabase
                .from('production_batches')
                .update({ 
                  status: nextStage.code,
                  updated_at: new Date().toISOString()
                })
                .eq('id', batchInfo.id);
            } else {
              await supabase
                .from('production_batches')
                .update({ 
                  status: 'ready',
                  updated_at: new Date().toISOString()
                })
                .eq('id', batchInfo.id);
            }
          }
        }

        if (nextStatus && (!batchInfo || batchInfo.status !== nextStatus)) {
          await supabase
            .from('production_batches')
            .update({ 
              status: nextStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', entryDetails.batch_id);
        }
      } catch (payrollErr: any) {
        console.error('[ApproveEntry] Payroll accrual or auto-advance failed:', payrollErr);
        // We don't return here because the entry was already approved above
      }
    }

    return ApiResponse.success({ success: true, status: newStatus });
  } catch (err: any) {
    return ApiResponse.handle(err, 'entries_approve');
  }
}
