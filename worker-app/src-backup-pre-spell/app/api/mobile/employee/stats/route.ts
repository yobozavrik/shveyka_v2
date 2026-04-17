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

  // Загружаем текущий открытый период зарплаты
  const { data: openPeriod, error: periodError } = await supabase
    .from('payroll_periods')
    .select('id, period_start, period_end')
    .eq('is_closed', false)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (periodError) {
    console.error('Payroll period lookup error:', periodError);
  }

  // Загружаем начисления за текущий период
  let currentPeriodEarnings = { amount: 0, quantity: 0 };
  if (openPeriod) {
    const { data: accrual, error: accrualError } = await supabase
      .from('payroll_accruals')
      .select('piecework_amount, piecework_quantity')
      .eq('payroll_period_id', openPeriod.id)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (accrual && !accrualError) {
      currentPeriodEarnings = {
        amount: Number(accrual.piecework_amount || 0),
        quantity: Number(accrual.piecework_quantity || 0),
      };
    }
  }

  // Загружаем начисления за всё время
  const { data: totalAccrual, error: totalAccrualError } = await supabase
    .from('payroll_accruals')
    .select('piecework_amount, piecework_quantity')
    .eq('employee_id', employeeId)
    .maybeSingle();

  const totalEarnings = {
    amount: Number(totalAccrual?.piecework_amount || 0),
    quantity: Number(totalAccrual?.piecework_quantity || 0),
  };

  // Статистика за сегодня
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { data: todayEntries, error: todayError } = await supabase
    .from('task_entries')
    .select('id, quantity, data, recorded_at, task_id, stage_id, batch_id')
    .eq('employee_id', employeeId)
    .gte('recorded_at', todayISO)
    .order('recorded_at', { ascending: false });

  // Для раскроя: умножаем quantity_per_nastil на количество размеров
  async function calculateRealQuantity(entry: any): Promise<number> {
    const qty = Number(entry.quantity || 0);

    // Проверяем что это раскрой
    if (entry.stage_id) {
      const { data: stage } = await supabase
        .from('production_stages')
        .select('code')
        .eq('id', entry.stage_id)
        .maybeSingle();

      if (stage?.code === 'cutting') {
        // Для раскроя: quantity = quantity_per_nastil × количество размеров
        const sizeCount = await getSizeCountForBatch(entry.batch_id);
        return qty * Math.max(1, sizeCount);
      }
    }

    return qty;
  }

  async function getSizeCountForBatch(batchId: number): Promise<number> {
    const { data: batch } = await supabase
      .from('production_batches')
      .select('size_variants')
      .eq('id', batchId)
      .maybeSingle();

    if (!batch?.size_variants) return 0;

    const sv = batch.size_variants;
    // Извлекаем количество размеров из size_variants
    if (Array.isArray(sv.selected_sizes)) return sv.selected_sizes.length;
    if (Array.isArray(sv.sizes)) return sv.sizes.length;

    // Если это объект — считаем ключи (исключая special keys)
    const specialKeys = ['selected_sizes', 'sizes'];
    return Object.keys(sv).filter(k => !specialKeys.includes(k)).length;
  }

  // Кэшируем размерности пакетов
  const batchSizeCache = new Map<number, number>();

  // Предзагружаем размеры для всех batch_id из записей
  const allBatchIds = new Set<number>();
  if (todayEntries) {
    for (const e of todayEntries) {
      if (e.batch_id) allBatchIds.add(e.batch_id);
    }
  }

  for (const batchId of allBatchIds) {
    const sizeCount = await getSizeCountForBatch(batchId);
    batchSizeCache.set(batchId, sizeCount);
  }

  // Проверяем какие batch связаны с cutting stage
  const stageCodeCache = new Map<number, string>();
  const stageIdsFromEntries = new Set(todayEntries?.map(e => e.stage_id).filter(Boolean));

  for (const stageId of stageIdsFromEntries) {
    const { data: stage } = await supabase
      .from('production_stages')
      .select('code')
      .eq('id', stageId)
      .maybeSingle();
    if (stage) stageCodeCache.set(stageId, stage.code);
  }

  const todayStats = {
    operations: todayEntries?.length || 0,
    quantity: await (async () => {
      let total = 0;
      for (const e of todayEntries || []) {
        const qty = Number(e.quantity || 0);
        const stageCode = e.stage_id ? stageCodeCache.get(e.stage_id) : null;

        if (stageCode === 'cutting' && e.batch_id) {
          // Для раскроя: quantity_per_nastil × количество размеров
          const sizeCount = batchSizeCache.get(e.batch_id) || 1;
          total += qty * Math.max(1, sizeCount);
        } else {
          total += qty;
        }
      }
      return total;
    })(),
    batches: new Set(todayEntries?.map(e => e.task_id)).size,
  };

  // Активность за последние 7 дней
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentActivity, error: activityError } = await supabase
    .from('employee_activity_log')
    .select('action, quantity, recorded_at, batch_number, stage_code, stage_name')
    .eq('employee_id', employeeId)
    .gte('recorded_at', sevenDaysAgo.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(100);

  // Группируем по дням
  const activityByDay: Record<string, { amount: number; quantity: number; operations: number }> = {};
  for (const entry of recentActivity || []) {
    const date = new Date(entry.recorded_at).toISOString().split('T')[0];
    if (!activityByDay[date]) {
      activityByDay[date] = { amount: 0, quantity: 0, operations: 0 };
    }
    activityByDay[date].operations += 1;
    activityByDay[date].quantity += Number(entry.quantity || 0);
    // Сумму можно будет добавить если есть связь с payroll
  }

  // Текущие задачи (в работе)
  const { data: currentTasks, error: tasksError } = await supabase
    .from('batch_tasks')
    .select(`
      id, batch_id, status, task_type, assigned_role, accepted_at,
      production_batches(id, batch_number, quantity, product_models(id, name)),
      production_stages(id, code, name)
    `)
    .eq('accepted_by_employee_id', employeeId)
    .in('status', ['accepted', 'in_progress'])
    .order('accepted_at', { ascending: false })
    .limit(10);

  if (tasksError) {
    console.error('Current tasks lookup error:', tasksError);
  }

  // Общая статистика за всё время
  const { data: allTimeEntries, error: allTimeError } = await supabase
    .from('task_entries')
    .select('quantity')
    .eq('employee_id', employeeId);

  const allTimeStats = {
    total_operations: allTimeEntries?.length || 0,
    total_quantity: allTimeEntries?.reduce((sum, e) => sum + Number(e.quantity || 0), 0) || 0,
  };

  // Активность по этапам
  const { data: stageActivity, error: stageActivityError } = await supabase
    .from('employee_activity_log')
    .select('stage_code, stage_name, quantity')
    .eq('employee_id', employeeId)
    .order('recorded_at', { ascending: false })
    .limit(500);

  const stageStats: Record<string, { name: string; operations: number; quantity: number }> = {};
  for (const entry of stageActivity || []) {
    const code = entry.stage_code || 'unknown';
    if (!stageStats[code]) {
      stageStats[code] = { name: entry.stage_name || code, operations: 0, quantity: 0 };
    }
    stageStats[code].operations += 1;
    stageStats[code].quantity += Number(entry.quantity || 0);
  }

  return NextResponse.json({
    employee,
    earnings: {
      current_period: currentPeriodEarnings,
      total: totalEarnings,
      period_info: openPeriod,
    },
    today: todayStats,
    all_time: allTimeStats,
    activity_by_day: activityByDay,
    stage_stats: stageStats,
    current_tasks: currentTasks?.map(t => {
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
  });
}
