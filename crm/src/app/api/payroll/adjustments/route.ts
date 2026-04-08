import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const employee_id = searchParams.get('employee_id');
  const period_id = searchParams.get('period_id');
  
  const supabase = await createServerClient(true);
  let query = supabase.from('payroll_adjustments').select('*');
  
  if (employee_id) query = query.eq('employee_id', employee_id);
  if (period_id) query = query.eq('period_id', period_id);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createServerClient();

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
