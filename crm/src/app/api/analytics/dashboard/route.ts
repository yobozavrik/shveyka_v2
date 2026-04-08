import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth, requireAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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

    const [batchesRes, entriesRes, employeesRes, operationsRes, pendingRes] = await Promise.all([
      supabase.from('production_batches')
        .select('id, status, quantity')
        .in('status', ['created', 'cutting', 'sewing', 'ready']),
      supabase.from('operation_entries')
        .select('id, quantity, status, employee_id, operation_id, created_at')
        .gte('entry_date', dateFromStr),
      supabase.from('employees')
        .select('id, full_name, position, department, payment_type')
        .eq('status', 'active'),
      supabase.from('operations')
        .select('id, base_rate')
        .in('operation_type', ['piecework', 'sewing', 'cutting', 'embroidery']),
      supabase.from('operation_entries')
        .select('id')
        .eq('status', 'submitted'),
    ]);

    const batches = Array.isArray(batchesRes.data) ? batchesRes.data : [];
    const entries = Array.isArray(entriesRes.data) ? entriesRes.data : [];
    const employees = Array.isArray(employeesRes.data) ? employeesRes.data : [];
    const operations = Array.isArray(operationsRes.data) ? operationsRes.data : [];
    const pending = Array.isArray(pendingRes.data) ? pendingRes.data : [];

    if (batchesRes.error || entriesRes.error || employeesRes.error || operationsRes.error || pendingRes.error) {
      console.warn('Supabase analytics fallback:', {
        batches: batchesRes.error?.message,
        entries: entriesRes.error?.message,
        employees: employeesRes.error?.message,
        operations: operationsRes.error?.message,
        pending: pendingRes.error?.message,
      });
    }

    // Total output
    type EntryRow = { id: number; quantity: number; status: string; employee_id: number; operation_id: number; created_at: string };
    const allEntries = (entries as unknown as EntryRow[]);
    const confirmedEntries = allEntries.filter(e => e.status === 'confirmed');
    const totalQty = confirmedEntries.reduce((s, e) => s + (e.quantity || 0), 0);
    const totalEarnings = confirmedEntries.reduce((s, e) => {
      const rate = operations.find((op: any) => op.id === e.operation_id)?.base_rate || 0;
      return s + rate * (e.quantity || 0);
    }, 0);

    // Daily breakdown
    const dailyMap: Record<string, { qty: number; count: number }> = {};
    for (const e of confirmedEntries) {
      if (!e.created_at) continue;
      const day = e.created_at.slice(0, 10);
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

    return NextResponse.json({
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
    console.error('Dashboard analytics exception:', e);
    return NextResponse.json({
      period: 'week',
      summary: {
        active_batches: 0,
        total_batch_qty: 0,
        active_employees: 0,
        entries_count: 0,
        confirmed_qty: 0,
        total_earnings: 0,
        pending_approvals: 0,
      },
      daily: [],
      top_workers: [],
      batches_by_status: {},
    });
  }
}
