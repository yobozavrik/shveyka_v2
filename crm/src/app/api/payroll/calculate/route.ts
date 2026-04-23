import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const body = await request.json();
    const { period_id } = body;
    if (!period_id) return ApiResponse.error('Missing period_id', ERROR_CODES.BAD_REQUEST, 400);

    const supabase = await createServerClient(true);

    // 1. Get period details
    const { data: period, error: pErr } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', period_id)
      .single();

    if (pErr) return ApiResponse.handle(pErr, 'payroll_calculate');

    // 2. Get all approved entries in period
    const { data: entries, error: eErr } = await supabase
      .from('task_entries')
      .select(`
        id, quantity, employee_id, operation_id, batch_id, recorded_at,
        production_batches:batch_id(route_card_id),
        stage_operations:operation_id(code)
      `)
      .eq('status', 'approved')
      .gte('recorded_at', period.period_start)
      .lte('recorded_at', period.period_end);

    if (eErr) return ApiResponse.handle(eErr, 'payroll_calculate');

    const operationCodes = [...new Set(entries.map((e: any) => e.stage_operations?.code).filter(Boolean))];
    const { data: allOps } = await supabase
      .from('operations')
      .select('id, code, base_rate')
      .in('code', operationCodes);

    const opMapByCode: Record<string, { id: number, base_rate: number }> = {};
    if (allOps) {
      allOps.forEach(op => {
        opMapByCode[op.code] = { id: Number(op.id), base_rate: Number(op.base_rate || 0) };
      });
    }

    // 3. Get all adjustments
    const { data: adjustments, error: aErr } = await supabase
      .from('payroll_adjustments')
      .select('*')
      .eq('period_id', period_id);

    if (aErr) return ApiResponse.handle(aErr, 'payroll_calculate');

    // 4. Get active employees
    const { data: employees } = await supabase
      .from('employees')
      .select('id, full_name');

    // 5. Pre-fetch all relevant route card operations
    const routeCardIds = [...new Set(entries.map((e: any) => e.production_batches?.route_card_id).filter(id => id !== null))];
    const customRateMap: Record<string, number> = {};

    if (routeCardIds.length > 0) {
      const { data: routeOps } = await supabase
        .from('route_card_operations')
        .select('route_card_id, operation_id, custom_rate')
        .in('route_card_id', routeCardIds);
      
      if (routeOps) {
        routeOps.forEach(op => {
          if (op.custom_rate !== null) {
            customRateMap[`${op.route_card_id}:${op.operation_id}`] = Number(op.custom_rate);
          }
        });
      }
    }

    // 6. Aggregate
    const payrollMap: Record<number, any> = {};
    
    if (employees) {
      employees.forEach(emp => {
        payrollMap[emp.id] = {
          employee_id: emp.id,
          full_name: emp.full_name,
          piece_rate_amount: 0,
          bonus_amount: 0,
          deduction_amount: 0,
          advance_amount: 0,
          total_amount: 0,
          confirmed_quantity: 0,
          adjustments: []
        };
      });
    }

    entries.forEach((entry: any) => {
      const empId = entry.employee_id;
      if (payrollMap[empId]) {
        const code = entry.stage_operations?.code;
        const opInfo = code ? opMapByCode[code] : null;
        
        if (opInfo) {
          const routeCardId = entry.production_batches?.route_card_id;
          const key = `${routeCardId}:${opInfo.id}`;
          
          const rate = (routeCardId && customRateMap[key] !== undefined) 
                   ? customRateMap[key] 
                   : opInfo.base_rate;

          payrollMap[empId].piece_rate_amount += (entry.quantity || 0) * rate;
          payrollMap[empId].confirmed_quantity += (entry.quantity || 0);
        }
      }
    });

    adjustments.forEach((adj: any) => {
      const empId = adj.employee_id;
      if (payrollMap[empId]) {
        payrollMap[empId].adjustments.push(adj);
        if (adj.adjustment_type === 'bonus') payrollMap[empId].bonus_amount += adj.amount;
        if (adj.adjustment_type === 'deduction') payrollMap[empId].deduction_amount += adj.amount;
        if (adj.adjustment_type === 'advance') payrollMap[empId].advance_amount += adj.amount;
        if (adj.adjustment_type === 'correction') {
            if (adj.amount > 0) payrollMap[empId].bonus_amount += adj.amount;
            else payrollMap[empId].deduction_amount += Math.abs(adj.amount);
        }
      }
    });

    const result = Object.values(payrollMap).map((item: any) => {
      item.total_amount = item.piece_rate_amount + item.bonus_amount - item.deduction_amount - item.advance_amount;
      return item;
    });

    return ApiResponse.success(result);
  } catch (e: any) {
    return ApiResponse.handle(e, 'payroll_calculate');
  }
}
