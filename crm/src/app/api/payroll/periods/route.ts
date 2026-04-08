import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerClient(true);
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .order('period_start', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const supabase = await createServerClient(true); // Using admin client for periods management

  const { data, error } = await supabase
    .from('payroll_periods')
    .insert({
      period_start: body.period_start || body.date_from,
      period_end: body.period_end || body.date_to,
      is_closed: body.is_closed || false,
      notes: body.notes || ''
    })
    .select()
    .single();

  if (error) {
    console.error('[PayrollPeriods] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
