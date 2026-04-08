import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { entry_id, action, comment: _comment } = body;

    if (!entry_id || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Невірні параметри' }, { status: 400 });
    }

    const supabase = await createServerClient(true);
    const newStatus = action === 'confirm' ? 'approved' : 'rejected';

    console.log(`[ApproveEntry] Processing id=${entry_id}, action=${action}`);

    // Ensure entry_id is a number if it comes as a string
    const numericId = typeof entry_id === 'string' ? parseInt(entry_id, 10) : entry_id;

    const { data, error } = await supabase
      .from('operation_entries')
      .update({ 
        status: newStatus 
        // removed updated_at as it is managed by a database trigger
      })
      .eq('id', numericId)
      .eq('status', 'submitted')
      .select()
      .maybeSingle(); // maybeSingle instead of single to avoid error on empty result

    if (error) {
      console.error('[ApproveEntry] Supabase error:', error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    if (!data) {
      console.warn(`[ApproveEntry] Entry ${entry_id} not found or not in 'submitted' status`);
      return NextResponse.json({ error: 'Запис не знайдено або вже підтверджено' }, { status: 404 });
    }

    // --- PAYROLL ACCRUAL LOGIC (Priority 2) ---
    if (action === 'confirm' && data) {
      try {
        const { data: entryDetails, error: detailErr } = await supabase
          .from('operation_entries')
          .select('quantity, employee_id, production_batch_id, operation_id')
          .eq('id', numericId)
          .single();

        if (detailErr || !entryDetails) throw new Error(`Could not fetch details: ${detailErr?.message}`);

        const { data: opRow } = await supabase
          .from('operations')
          .select('base_rate')
          .eq('id', entryDetails.operation_id)
          .maybeSingle();

        const { data: batchRow } = await supabase
          .from('production_batches')
          .select('route_card_id')
          .eq('id', entryDetails.production_batch_id)
          .maybeSingle();

        let rate = opRow?.base_rate || 0;
        let nextStatus: string | null = null;

        const routeCardId = batchRow?.route_card_id;
        
        if (routeCardId) {
          const { data: routeOp } = await supabase
            .from('route_card_operations')
            .select('custom_rate, batch_status_on_confirm')
            .eq('route_card_id', routeCardId)
            .eq('operation_id', entryDetails.operation_id)
            .maybeSingle();
          
          if (routeOp) {
            if (routeOp.custom_rate !== null) rate = routeOp.custom_rate;
            if (routeOp.batch_status_on_confirm) nextStatus = routeOp.batch_status_on_confirm;
          }
        }

        const amount = (entryDetails.quantity || 0) * rate;

        // 3. Find active payroll period
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
          // 4. UPSERT into payroll_accruals
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
          console.log(`[ApproveEntry] Accrued ${amount} for employee ${entryDetails.employee_id} (Rate: ${rate})`);
        }

        // 5. Batch Status Advance (Priority 1)
        if (nextStatus) {
          console.log(`[ApproveEntry] Advancing batch ${entryDetails.production_batch_id} to ${nextStatus}`);
          await supabase
            .from('production_batches')
            .update({ 
              status: nextStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', entryDetails.production_batch_id);
        }
      } catch (payrollErr) {
        console.error('[ApproveEntry] Payroll accrual or status advancement failed:', payrollErr);
        // Error here is non-blocking for the approval itself to ensure operational continuity
      }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err: any) {
    console.error('[ApproveEntry] Unexpected error:', err);
    return NextResponse.json({ 
      error: err.message || 'Внутрішня помилка сервера',
      details: err.details || err,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}
