import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const empId = parseInt(id);
  const supabase = await createServerClient(true);

  // 1. Get Employee Data
  const { data: employee } = await supabase.from('employees').select('id, full_name, position, phone, status, payment_type, department, hire_date, birth_date, family_info, address, skill_level, individual_coefficient, supervisor_id').eq('id', empId).single();
  if (!employee) return NextResponse.json({ error: 'Не знайдено' }, { status: 404 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startIso = thirtyDaysAgo.toISOString();

  // 2. Entries stats - Fetch entries with operation details for time norms
  const { data: all_entries } = await supabase
    .from('operation_entries')
    .select('id, quantity, status, entry_date, operation_id')
    .eq('employee_id', empId)
    .gte('entry_date', startIso.split('T')[0]);

  const confirmed = (all_entries || []).filter(e => e.status === 'approved' || e.status === 'confirmed');
  const rejected = (all_entries || []).filter(e => e.status === 'rejected');

  const totalQuantity = confirmed.reduce((s: number, e: any) => s + e.quantity, 0);
  const rejectedQuantity = rejected.reduce((s: number, e: any) => s + e.quantity, 0);

  // 3. Efficiency Calculation (Earned Minutes vs Worked Minutes)
  const operationIds = [...new Set((all_entries || []).map((e: any) => e.operation_id).filter(Boolean))];
  const { data: operations } = operationIds.length > 0
    ? await supabase.from('operations').select('id, base_rate, time_norm_minutes').in('id', operationIds)
    : { data: [] as any[] };

  const earnedMinutes = confirmed.reduce((s: number, e: any) => {
    const ops = operations?.find((op: any) => op.id === e.operation_id);
    return s + e.quantity * (ops?.time_norm_minutes || 0);
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
    const ops = operations?.find((op: any) => op.id === e.operation_id);
    return s + e.quantity * (ops?.base_rate || 0);
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

  return NextResponse.json({
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
  });
}
