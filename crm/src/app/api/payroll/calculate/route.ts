import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { period_id } = body;
  if (!period_id) return NextResponse.json({ error: 'Missing period_id' }, { status: 400 });

  const supabase = await createServerClient(true);

  // 1. Get period details
  const { data: period, error: pErr } = await supabase
    .from('payroll_periods')
    .select('*')
    .eq('id', period_id)
    .single();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // 2. Get all approved entries in period with their production batch context
  // We need production_batch_id and operation_id to find the correct rate later
  const { data: entries, error: eErr } = await supabase
    .from('operation_entries')
    .select(`
      id, quantity, employee_id, operation_id, production_batch_id,
      production_batches(route_card_id),
      operations(base_rate)
    `)
    .eq('status', 'approved')
    .gte('entry_date', period.period_start)
    .lte('entry_date', period.period_end);

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  // 3. Get all adjustments for period (or global if not tied to period but for these employees)
  const { data: adjustments, error: aErr } = await supabase
    .from('payroll_adjustments')
    .select('*')
    .eq('period_id', period_id);

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  // 4. Get active employees to ensure we show everyone
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, full_name, payment_type')
    .eq('status', 'active');

  if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });

  // 5. Pre-fetch all relevant route card operations to avoid N+1 and handle correct rates
  const routeCardIds = [...new Set(entries.map((e: any) => e.production_batches?.route_card_id).filter(id => id !== null))];
  const rateMap: Record<string, number> = {}; // key: route_card_id:operation_id

  if (routeCardIds.length > 0) {
    const { data: routeOps } = await supabase
      .from('route_card_operations')
      .select('route_card_id, operation_id, custom_rate')
      .in('route_card_id', routeCardIds);
    
    if (routeOps) {
      routeOps.forEach(op => {
        if (op.custom_rate !== null) {
          rateMap[`${op.route_card_id}:${op.operation_id}`] = Number(op.custom_rate);
        }
      });
    }
  }

  // 6. Aggregate
  const payrollMap: Record<number, any> = {};
  
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

  entries.forEach((entry: any) => {
    const empId = entry.employee_id;
    if (payrollMap[empId]) {
      const routeCardId = entry.production_batches?.route_card_id;
      const key = `${routeCardId}:${entry.operation_id}`;
      
      const rate = (routeCardId && rateMap[key] !== undefined) 
                 ? rateMap[key] 
                 : (entry.operations?.base_rate || 0);

      payrollMap[empId].piece_rate_amount += entry.quantity * rate;
      payrollMap[empId].confirmed_quantity += entry.quantity;
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
          // Corrections can be +/-
          if (adj.amount > 0) payrollMap[empId].bonus_amount += adj.amount;
          else payrollMap[empId].deduction_amount += Math.abs(adj.amount);
      }
    }
  });

  // Calculate totals
  const result = Object.values(payrollMap).map((item: any) => {
    item.total_amount = item.piece_rate_amount + item.bonus_amount - item.deduction_amount - item.advance_amount;
    return item;
  });

  return NextResponse.json(result);
}
