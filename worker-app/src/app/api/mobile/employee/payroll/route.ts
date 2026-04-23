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

  // Single query for all accruals instead of N+1 loop
  const periodIds = (periods || []).map((p: any) => p.id);
  let allAccruals: any[] = [];
  if (periodIds.length > 0) {
    const { data: accruals, error: accrualsError } = await supabase
      .from('payroll_accruals')
      .select('payroll_period_id, piecework_amount, piecework_quantity, total_amount, employee_id')
      .in('payroll_period_id', periodIds)
      .eq('employee_id', employeeId);

    if (accrualsError) {
      console.error('Accrual lookup error:', accrualsError);
    }
    allAccruals = accruals || [];
  }

  // Build lookup map
  const accrualMap = new Map<number, any>();
  for (const a of allAccruals) {
    accrualMap.set(a.payroll_period_id, a);
  }

  // Build payroll history from periods + accrual map
  const payrollHistory = (periods || []).map((period: any) => {
    const accrual = accrualMap.get(period.id);
    return {
      period_start: period.period_start,
      period_end: period.period_end,
      is_paid: period.is_closed,
      paid_date: period.is_closed ? period.period_end : null,
      amount: accrual ? Number(accrual.piecework_amount || 0) : 0,
      quantity: accrual ? Number(accrual.piecework_quantity || 0) : 0,
    };
  });

  return NextResponse.json({
    payroll_history: payrollHistory,
  });
}
