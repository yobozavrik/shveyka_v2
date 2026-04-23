import { createServerClient } from '@/lib/supabase/server';

const PRIVILEGED_ROLES = ['admin', 'manager', 'accountant', 'hr'];

export class PayrollService {
  static async getAdjustments(params: { employee_id?: string | null, period_id?: string | null }, auth: any) {
    const supabase = await createServerClient(true);
    let query = supabase.from('payroll_adjustments').select('*');
    
    if (!PRIVILEGED_ROLES.includes(auth.role)) {
      if (auth.employeeId) {
        query = query.eq('employee_id', auth.employeeId);
      } else {
        return { success: false, error: 'Forbidden', status: 403 };
      }
    } else if (params.employee_id) {
      query = query.eq('employee_id', params.employee_id);
    }
    
    if (params.period_id) query = query.eq('period_id', params.period_id);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message, status: 500 };
    return { success: true, data };
  }

  static async createAdjustment(body: any, auth: any) {
    if (!PRIVILEGED_ROLES.includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('payroll_adjustments')
      .insert({
        employee_id: body.employee_id,
        period_id: body.period_id,
        amount: body.amount,
        adjustment_type: body.adjustment_type,
        reason: body.reason,
        created_by: auth.userId
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message, status: 500 };
    return { success: true, data };
  }

  static async getPayrollData(startDate: string | null, endDate: string | null, auth: any) {
    if (!['admin', 'manager'].includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const supabase = await createServerClient(true);
    
    let query = supabase
      .from('task_entries')
      .select(`
        id,
        quantity,
        recorded_at,
        created_at,
        employees!inner(id, full_name, position),
        stage_operations!task_entries_operation_id_fkey(id, code)
      `)
      .eq('status', 'approved');

    if (startDate) query = query.gte('recorded_at', startDate);
    if (endDate) query = query.lte('recorded_at', endDate);

    const { data, error } = await query;

    if (error) return { success: false, error: error.message, status: 500 };
    if (!data || data.length === 0) return { success: true, data: [] };

    // Load operation rates by code
    const opCodes = [...new Set((data as any[]).map(e => {
      const stageOp = e.stage_operations;
      return Array.isArray(stageOp) ? stageOp[0]?.code : stageOp?.code;
    }).filter(Boolean))];

    let rateMap = new Map<string, number>();
    if (opCodes.length > 0) {
      const { data: ops } = await supabase
        .from('operations')
        .select('code, base_rate')
        .in('code', opCodes);
      if (ops) {
        ops.forEach(op => rateMap.set(op.code, op.base_rate || 0));
      }
    }

    const payroll: Record<string, any> = {};

    data.forEach((entry: any) => {
      const employee = entry.employees;
      const stageOp = entry.stage_operations;
      if (!employee || !stageOp) return;

      const empId = employee.id;
      if (!payroll[empId]) {
        payroll[empId] = {
          id: empId,
          full_name: employee.full_name || 'Невідомий',
          total: 0,
          count: 0,
          entries: []
        };
      }

      const rate = rateMap.get(stageOp.code) || 0;
      const qty = entry.quantity || 0;
      const amount = qty * rate;

      payroll[empId].total += amount;
      payroll[empId].count += 1;

      payroll[empId].entries.push({
        ...entry,
        employee,
        operations: { ...stageOp, base_rate: rate, name: stageOp.code },
        amount
      });
    });

    return { success: true, data: Object.values(payroll) };
  }
}
