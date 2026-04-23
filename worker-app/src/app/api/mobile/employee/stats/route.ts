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

  // Загружаем данные сотрудника
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, full_name, employee_number, position, department, photo_url, status')
    .eq('id', employeeId)
    .single();

  if (employeeError || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  // Загружаем текущий открытый период + начисления за него + начисления за всё время
  const [{ data: openPeriod }, { data: totalAccrual }] = await Promise.all([
    supabase
      .from('payroll_periods')
      .select('id, period_start, period_end')
      .eq('is_closed', false)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('payroll_accruals')
      .select('piecework_amount, piecework_quantity')
      .eq('employee_id', employeeId)
      .maybeSingle(),
  ]);

  // Загружаем начисления за текущий период
  let currentPeriodEarnings = { amount: 0, quantity: 0 };
  if (openPeriod) {
    const { data: accrual } = await supabase
      .from('payroll_accruals')
      .select('piecework_amount, piecework_quantity')
      .eq('payroll_period_id', openPeriod.id)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (accrual) {
      currentPeriodEarnings = {
        amount: Number(accrual.piecework_amount || 0),
        quantity: Number(accrual.piecework_quantity || 0),
      };
    }
  }

  const totalEarnings = {
    amount: Number(totalAccrual?.piecework_amount || 0),
    quantity: Number(totalAccrual?.piecework_quantity || 0),
  };

  // Статистика за сегодня
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { data: todayEntries } = await supabase
    .from('task_entries')
    .select('id, quantity, data, recorded_at, task_id, stage_id, batch_id')
    .eq('employee_id', employeeId)
    .gte('recorded_at', todayISO)
    .order('recorded_at', { ascending: false });

  // Batch-загружаем stage codes вместо N+1 цикла
  const stageIdsFromEntries = [...new Set(todayEntries?.map((e: any) => e.stage_id).filter(Boolean))];
  let stageCodeMap = new Map<number, string>();
  if (stageIdsFromEntries.length > 0) {
    const { data: stages } = await supabase
      .from('production_stages')
      .select('id, code')
      .in('id', stageIdsFromEntries);
    for (const s of stages || []) {
      stageCodeMap.set(s.id, s.code);
    }
  }

  // Batch-загружаем size counts для всех batch_id
  const allBatchIds = [...new Set(todayEntries?.map((e: any) => e.batch_id).filter(Boolean))];
  let batchSizeMap = new Map<number, number>();
  if (allBatchIds.length > 0) {
    const { data: batches } = await supabase
      .from('production_batches')
      .select('id, size_variants')
      .in('id', allBatchIds);
    for (const b of batches || []) {
      const sv = b.size_variants;
      let sizeCount = 0;
      if (sv) {
        if (Array.isArray(sv.selected_sizes)) sizeCount = sv.selected_sizes.length;
        else if (Array.isArray(sv.sizes)) sizeCount = sv.sizes.length;
        else {
          const specialKeys = ['selected_sizes', 'sizes'];
          sizeCount = Object.keys(sv).filter(k => !specialKeys.includes(k)).length;
        }
      }
      batchSizeMap.set(b.id, sizeCount);
    }
  }

  const todayStats = {
    operations: todayEntries?.length || 0,
    quantity: (() => {
      let total = 0;
      for (const e of todayEntries || []) {
        const qty = Number(e.quantity || 0);
        const stageCode = e.stage_id ? stageCodeMap.get(e.stage_id) : null;
        if (stageCode === 'cutting' && e.batch_id) {
          const sizeCount = batchSizeMap.get(e.batch_id) || 1;
          total += qty * Math.max(1, sizeCount);
        } else {
          total += qty;
        }
      }
      return total;
    })(),
    batches: new Set(todayEntries?.map((e: any) => e.task_id)).size,
  };

  // Активность за последние 7 дней + текущие задачи + общая статистика + активность по этапам — все независимые запросы
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    { data: recentActivity },
    { data: currentTasks, error: tasksError },
    { data: allTimeEntries, error: allTimeError },
    { data: stageActivity, error: stageActivityError },
  ] = await Promise.all([
    supabase
      .from('employee_activity_log')
      .select('action, quantity, recorded_at, batch_number, stage_code, stage_name')
      .eq('employee_id', employeeId)
      .gte('recorded_at', sevenDaysAgo.toISOString())
      .order('recorded_at', { ascending: false })
      .limit(100),
    supabase
      .from('batch_tasks')
      .select(`
        id, batch_id, status, task_type, assigned_role, accepted_at,
        production_batches(id, batch_number, quantity, product_models(id, name)),
        production_stages(id, code, name)
      `)
      .eq('accepted_by_employee_id', employeeId)
      .in('status', ['accepted', 'in_progress'])
      .order('accepted_at', { ascending: false })
      .limit(10),
    supabase
      .from('task_entries')
      .select('quantity')
      .eq('employee_id', employeeId),
    supabase
      .from('employee_activity_log')
      .select('stage_code, stage_name, quantity')
      .eq('employee_id', employeeId)
      .order('recorded_at', { ascending: false })
      .limit(500),
  ]);

  if (tasksError) {
    console.error('Current tasks lookup error:', tasksError);
  }
  if (allTimeError) {
    console.error('All-time entries lookup error:', allTimeError);
  }
  if (stageActivityError) {
    console.error('Stage activity lookup error:', stageActivityError);
  }

  // Группируем по дням
  const activityByDay: Record<string, { amount: number; quantity: number; operations: number }> = {};
  for (const entry of recentActivity || []) {
    const date = new Date((entry as any).recorded_at).toISOString().split('T')[0];
    if (!activityByDay[date]) {
      activityByDay[date] = { amount: 0, quantity: 0, operations: 0 };
    }
    activityByDay[date].operations += 1;
    activityByDay[date].quantity += Number((entry as any).quantity || 0);
  }

  // Общая статистика за всё время
  const allTimeStats = {
    total_operations: allTimeEntries?.length || 0,
    total_quantity: allTimeEntries?.reduce((sum: number, e: any) => sum + Number(e.quantity || 0), 0) || 0,
  };

  // Активность по этапам
  const stageStats: Record<string, { name: string; operations: number; quantity: number; earnings: number }> = {};
  for (const entry of stageActivity || []) {
    const code = (entry as any).stage_code || 'unknown';
    if (!stageStats[code]) {
      stageStats[code] = { name: (entry as any).stage_name || code, operations: 0, quantity: 0, earnings: 0 };
    }
    stageStats[code].operations += 1;
    stageStats[code].quantity += Number((entry as any).quantity || 0);
  }

  // ─── Quality stats ─────────────────────────────────
  const todayDateStr = new Date().toISOString().split('T')[0];
  const yesterdayDateStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const [{ data: todayDefects }, { data: lastDefect }] = await Promise.all([
    supabase
      .from('task_entries')
      .select('data')
      .eq('employee_id', employeeId)
      .gte('recorded_at', todayDateStr)
      .filter('data->>defect_quantity', 'gt', '0'),
    supabase
      .from('task_entries')
      .select('data, recorded_at, batch_id')
      .eq('employee_id', employeeId)
      .filter('data->>defect_quantity', 'gt', '0')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const todayGood = (todayEntries || []).reduce((sum: number, e: any) => {
    const qty = Number(e.quantity || 0);
    const defect = Number((e as any).data?.defect_quantity || 0);
    return sum + Math.max(0, qty - defect);
  }, 0);
  const todayDefectCount = todayDefects?.length || 0;
  const totalTodayToday = todayStats.quantity;
  const qualityPercentage = totalTodayToday > 0
    ? Math.round(((totalTodayToday - todayDefectCount) / totalTodayToday) * 100)
    : 100;

  // Last defect batch number
  let lastDefectBatch: string | null = null;
  if (lastDefect && lastDefect.batch_id) {
    const { data: batch } = await supabase
      .from('production_batches')
      .select('batch_number')
      .eq('id', lastDefect.batch_id)
      .maybeSingle();
    lastDefectBatch = batch?.batch_number || null;
  }

  // ─── Daily goal (derived from 7-day average) ──────
  const recentDaysArr = Object.values(activityByDay);
  const avgQuantity = recentDaysArr.length > 0
    ? Math.round(recentDaysArr.reduce((s: number, d: any) => s + d.quantity, 0) / recentDaysArr.length)
    : 100;
  const dailyGoalTarget = Math.ceil(avgQuantity * 1.2); // 20% above average
  const dailyGoalRemaining = Math.max(0, dailyGoalTarget - todayStats.quantity);
  const dailyGoalPercentage = dailyGoalTarget > 0
    ? Math.round((todayStats.quantity / dailyGoalTarget) * 100)
    : 0;

  // Estimated finish (assuming current rate)
  let estimatedFinish: string | null = null;
  if (todayStats.quantity > 0) {
    const now = new Date();
    const firstEntry = todayEntries?.[todayEntries.length - 1];
    if (firstEntry) {
      const firstTime = new Date((firstEntry as any).recorded_at).getTime();
      const elapsed = now.getTime() - firstTime;
      if (elapsed > 0) {
        const rate = todayStats.quantity / elapsed;
        const remaining = dailyGoalRemaining;
        const remainingMs = remaining / rate;
        const eta = new Date(now.getTime() + remainingMs);
        estimatedFinish = eta.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      }
    }
  }

  // ─── Earnings rate ─────────────────────────────────
  const ratePerPiece = currentPeriodEarnings.quantity > 0
    ? currentPeriodEarnings.amount / currentPeriodEarnings.quantity
    : 0;

  // ─── Today earnings ────────────────────────────────
  const todayEarnings = todayStats.quantity * (ratePerPiece || 10); // fallback rate

  // ─── Yesterday quantity ────────────────────────────
  const yesterdayQuantity = activityByDay[yesterdayDateStr]?.quantity || 0;

  return NextResponse.json({
    employee,
    earnings: {
      current_period: {
        amount: currentPeriodEarnings.amount,
        quantity: currentPeriodEarnings.quantity,
        rate: ratePerPiece,
      },
      total: totalEarnings,
      period_info: openPeriod,
    },
    today: {
      ...todayStats,
      earnings: todayEarnings,
      yesterday_quantity: yesterdayQuantity,
    },
    all_time: allTimeStats,
    activity_by_day: activityByDay,
    stage_stats: stageStats,
    current_tasks: currentTasks?.map((t: any) => {
      const batch = Array.isArray(t.production_batches) ? t.production_batches[0] : t.production_batches;
      const productModels = Array.isArray(batch?.product_models) ? batch?.product_models[0] : batch?.product_models;
      const stage = Array.isArray(t.production_stages) ? t.production_stages[0] : t.production_stages;

      return {
        id: t.id,
        batch_number: batch?.batch_number || `#${t.batch_id}`,
        product_name: productModels?.name || 'Без моделі',
        status: t.status,
        stage_name: stage?.name || t.task_type,
        accepted_at: t.accepted_at,
      };
    }) || [],
    quality: {
      good: todayGood,
      defect: todayDefectCount,
      percentage: qualityPercentage,
      last_defect_date: lastDefect ? new Date((lastDefect as any).recorded_at).toISOString().split('T')[0] : null,
      last_defect_batch: lastDefectBatch,
    },
    daily_goal: {
      target: dailyGoalTarget,
      current: todayStats.quantity,
      percentage: dailyGoalPercentage,
      remaining: dailyGoalRemaining,
      estimated_finish: estimatedFinish,
    },
  });
}
