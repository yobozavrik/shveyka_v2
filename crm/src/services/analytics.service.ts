import { createServerClient } from '@/lib/supabase/server';

export class AnalyticsService {
  static async getEmployeeStats(empId: number, auth: any) {
    // IDOR Protection: only admin, manager, hr, production_head or the employee themselves
    const ALLOWED_ROLES = ['admin', 'manager', 'hr', 'production_head'];
    if (!ALLOWED_ROLES.includes(auth.role) && auth.employeeId !== empId) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const supabase = await createServerClient(true);

    // 1. Get Employee Data
    const { data: employee } = await supabase
      .from('employees')
      .select('id, full_name, position, phone, status, payment_type, department, hire_date, birth_date, family_info, address, skill_level, individual_coefficient, supervisor_id')
      .eq('id', empId)
      .single();

    if (!employee) return { success: false, error: 'Не знайдено', status: 404 };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startIso = thirtyDaysAgo.toISOString();

    // 2. Entries stats
    const { data: all_entries } = await supabase
      .from('task_entries')
      .select('id, quantity, status, recorded_at, operation_id')
      .eq('employee_id', empId)
      .gte('recorded_at', startIso.split('T')[0]);

    const confirmed = (all_entries || []).filter(e => e.status === 'approved');
    const rejected = (all_entries || []).filter(e => e.status === 'rejected');

    const totalQuantity = confirmed.reduce((s: number, e: any) => s + e.quantity, 0);
    const rejectedQuantity = rejected.reduce((s: number, e: any) => s + e.quantity, 0);

    // 3. Efficiency Calculation
    const stageOpIds = [...new Set((all_entries || []).map((e: any) => e.operation_id).filter(Boolean))];
    
    const { data: stageOps } = stageOpIds.length > 0
      ? await supabase.from('stage_operations').select('id, code').in('id', stageOpIds)
      : { data: [] };

    const codes = (stageOps || []).map(so => so.code);
    
    const { data: operations } = codes.length > 0
      ? await supabase.from('operations').select('id, code, base_rate, time_norm_minutes').in('code', codes)
      : { data: [] };

    const stageToOpMap: Record<number, any> = {};
    if (stageOps && operations) {
      stageOps.forEach(so => {
        const op = operations.find(o => o.code === so.code);
        if (op) stageToOpMap[so.id] = op;
      });
    }

    const earnedMinutes = confirmed.reduce((s: number, e: any) => {
      const ops = stageToOpMap[e.operation_id];
      return s + (e.quantity || 0) * (ops?.time_norm_minutes || 0);
    }, 0);

    // 4. Attendance Stats
    const { data: attendance } = await supabase
      .from('employee_attendance')
      .select('check_in, check_out')
      .eq('employee_id', empId)
      .gte('check_in', startIso);

    const workedMinutes = (attendance || []).reduce((total, a) => {
      if (!a.check_in || !a.check_out) return total;
      const duration = (new Date(a.check_out).getTime() - new Date(a.check_in).getTime()) / (1000 * 60);
      return total + Math.max(duration, 0);
    }, 0);

    const efficiencyIndex = workedMinutes > 0 ? (earnedMinutes / workedMinutes) * 100 : 0;
    
    // 5. Earnings
    const totalEarned = confirmed.reduce((s: number, e: any) => {
      const ops = stageToOpMap[e.operation_id];
      return s + (e.quantity || 0) * (ops?.base_rate || 0);
    }, 0);

    // 6. Recent Payroll history
    const { data: payroll } = await supabase
      .from('payroll_accruals')
      .select('id, payroll_period_id, piecework_amount, piecework_quantity, total_amount, created_at')
      .eq('employee_id', empId)
      .order('created_at', { ascending: false })
      .limit(5);

    const totalProcessed = totalQuantity + rejectedQuantity;
    const ptmRate = totalProcessed > 0 ? (rejectedQuantity / totalProcessed) * 100 : 0;

    return {
      success: true,
      data: {
        employee,
        total_entries: confirmed.length,
        total_quantity: totalQuantity,
        total_earned: totalEarned,
        total_defects: rejectedQuantity,
        rejected_quantity: rejectedQuantity,
        ptm_rate: Math.round(ptmRate * 100) / 100,
        efficiency_index: Math.round(efficiencyIndex * 10) / 10,
        earned_minutes: Math.round(earnedMinutes),
        worked_minutes: Math.round(workedMinutes),
        payroll_history: payroll || []
      }
    };
  }

  static async getDepartmentsStats(days: number, auth: any) {
    if (!['admin', 'manager'].includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const supabase = await createServerClient(true);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('task_entries')
      .select('quantity, employees(department)')
      .eq('status', 'approved')
      .gte('recorded_at', dateFromStr);

    if (error) return { success: false, error: error.message, status: 500 };

    const deptMap: Record<string, { confirmed_units: number; entries_count: number }> = {};
    (data || []).forEach((e: any) => {
      const dept = e.employees?.department || 'Інше';
      if (!deptMap[dept]) deptMap[dept] = { confirmed_units: 0, entries_count: 0 };
      deptMap[dept].confirmed_units += e.quantity;
      deptMap[dept].entries_count += 1;
    });

    const result = Object.entries(deptMap).map(([name, vals]) => ({
      name,
      ...vals
    })).sort((a, b) => b.confirmed_units - a.confirmed_units);

    return { success: true, data: result };
  }

  static async getTopEmployees(days: number, limit: number, auth: any) {
    if (!['admin', 'manager', 'hr', 'production_head'].includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const supabase = await createServerClient(true);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('task_entries')
      .select('quantity, employee_id, employees(id, full_name, avatar_url, department)')
      .eq('status', 'approved')
      .gte('recorded_at', dateFromStr);

    if (error) return { success: false, error: error.message, status: 500 };

    const workerMap: Record<number, any> = {};
    (data || []).forEach((e: any) => {
      if (!e.employee_id || !e.employees) return;
      const id = e.employee_id;
      if (!workerMap[id]) {
        workerMap[id] = {
          id,
          full_name: e.employees.full_name,
          department: e.employees.department,
          avatar_url: e.employees.avatar_url,
          confirmed_units: 0,
          entries_count: 0
        };
      }
      workerMap[id].confirmed_units += e.quantity;
      workerMap[id].entries_count += 1;
    });

    const result = Object.values(workerMap)
      .sort((a: any, b: any) => b.confirmed_units - a.confirmed_units)
      .slice(0, limit);

    return { success: true, data: result };
  }
}
