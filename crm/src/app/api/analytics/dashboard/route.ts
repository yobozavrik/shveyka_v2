import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Access denied', ERROR_CODES.FORBIDDEN, 403);
    }

    const supabase = await createServerClient(true);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week'; // week | month | today

    const now = new Date();
    let dateFrom: Date;
    if (period === 'today') {
      dateFrom = new Date(now.toDateString());
    } else if (period === 'week') {
      dateFrom = new Date(now);
      dateFrom.setDate(dateFrom.getDate() - 7);
    } else {
      dateFrom = new Date(now);
      dateFrom.setMonth(dateFrom.getMonth() - 1);
    }

    const dateFromStr = dateFrom.toISOString().slice(0, 10);

    const [batchesRes, entriesRes, employeesRes, operationsRes, stageOpsRes, pendingRes] = await Promise.all([
      supabase.from('production_batches')
        .select('id, status, quantity')
        .in('status', ['created', 'cutting', 'sewing', 'overlock', 'straight_stitch', 'coverlock', 'packaging', 'ready']),
      supabase.from('task_entries')
        .select('id, quantity, status, employee_id, operation_id, recorded_at, created_at')
        .gte('recorded_at', dateFromStr),
      supabase.from('employees')
        .select('id, full_name, position, department, payment_type')
        .eq('status', 'active'),
      supabase.from('operations')
        .select('id, code, base_rate'),
      supabase.from('stage_operations')
        .select('id, code'),
      supabase.from('task_entries')
        .select('id')
        .eq('status', 'submitted'),
    ]);

    const batches = Array.isArray(batchesRes.data) ? batchesRes.data : [];
    const entries = Array.isArray(entriesRes.data) ? entriesRes.data : [];
    const employees = Array.isArray(employeesRes.data) ? employeesRes.data : [];
    const operations = Array.isArray(operationsRes.data) ? operationsRes.data : [];
    const stageOps = Array.isArray(stageOpsRes.data) ? stageOpsRes.data : [];
    const pending = Array.isArray(pendingRes.data) ? pendingRes.data : [];

    // Map stage_operation_id -> operation_code -> base_rate
    const stageToRateMap: Record<number, number> = {};
    const opMap: Record<string, number> = {};
    operations.forEach((op: any) => { opMap[op.code] = op.base_rate || 0; });
    stageOps.forEach((so: any) => { if (opMap[so.code]) stageToRateMap[so.id] = opMap[so.code]; });

    // Total output
    type EntryRow = { id: number; quantity: number; status: string; employee_id: number; operation_id: number; recorded_at: string; created_at: string };
    const allEntries = (entries as unknown as EntryRow[]);
    const confirmedEntries = allEntries.filter(e => e.status === 'approved');
    const totalQty = confirmedEntries.reduce((s, e) => s + (e.quantity || 0), 0);
    const totalEarnings = confirmedEntries.reduce((s, e) => {
      const rate = stageToRateMap[e.operation_id] || 0;
      return s + rate * (e.quantity || 0);
    }, 0);

    // Daily breakdown
    const dailyMap: Record<string, { qty: number; count: number }> = {};
    for (const e of confirmedEntries) {
      const dateStr = e.recorded_at || e.created_at;
      if (!dateStr) continue;
      const day = dateStr.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { qty: 0, count: 0 };
      dailyMap[day].qty += e.quantity || 0;
      dailyMap[day].count += 1;
    }

    const daily = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Top workers
    const workerMap: Record<number, { qty: number; count: number }> = {};
    for (const e of confirmedEntries) {
      if (!e.employee_id) continue;
      if (!workerMap[e.employee_id]) workerMap[e.employee_id] = { qty: 0, count: 0 };
      workerMap[e.employee_id].qty += e.quantity || 0;
      workerMap[e.employee_id].count += 1;
    }

    const topWorkers = Object.entries(workerMap)
      .map(([empId, v]) => {
        const emp = employees.find((e: { id: number }) => e.id === parseInt(empId));
        return { employee_id: parseInt(empId), full_name: emp?.full_name || 'Невідомий', ...v };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    return ApiResponse.success({
      period,
      summary: {
        active_batches: batches.length,
        total_batch_qty: batches.reduce((s: number, b: { quantity: number }) => s + (b.quantity || 0), 0),
        active_employees: employees.length,
        entries_count: entries.length,
        confirmed_qty: totalQty,
        total_earnings: Math.round(totalEarnings * 100) / 100,
        pending_approvals: pending.length,
      },
      daily,
      top_workers: topWorkers,
      batches_by_status: batches.reduce((acc: Record<string, number>, b: { status: string }) => {
        acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (e: any) {
    return ApiResponse.handle(e, 'analytics_dashboard');
  }
}
