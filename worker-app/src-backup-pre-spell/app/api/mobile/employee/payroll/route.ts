import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || !user.employeeId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = user.employeeId;
  const supabase = getSupabaseAdmin('shveyka');

  // Загружаем все периоды (сначала новые)
  const { data: periods, error: periodsError } = await supabase
    .from('payroll_periods')
    .select('id, period_start, period_end, is_closed')
    .order('period_start', { ascending: false })
    .limit(12);

  if (periodsError) {
    return NextResponse.json({ error: periodsError.message }, { status: 500 });
  }

  // Для каждого периода загружаем начисления сотрудника
  const payrollHistory = [];

  for (const period of periods || []) {
    const { data: accrual, error: accrualError } = await supabase
      .from('payroll_accruals')
      .select('piecework_amount, piecework_quantity, total_amount')
      .eq('payroll_period_id', period.id)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (accrualError) {
      console.error(`Accrual lookup error for period ${period.id}:`, accrualError);
    }

    if (accrual) {
      payrollHistory.push({
        period_id: period.id,
        period_start: period.period_start,
        period_end: period.period_end,
        is_closed: period.is_closed,
        amount: Number(accrual.piecework_amount || 0),
        quantity: Number(accrual.piecework_quantity || 0),
        total_amount: Number(accrual.total_amount || 0),
      });
    } else {
      payrollHistory.push({
        period_id: period.id,
        period_start: period.period_start,
        period_end: period.period_end,
        is_closed: period.is_closed,
        amount: 0,
        quantity: 0,
        total_amount: 0,
      });
    }
  }

  return NextResponse.json({
    payroll_history: payrollHistory,
  });
}
