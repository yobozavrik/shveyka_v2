import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerClient(true);

  const { data, error } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('employee_id', parseInt(id))
    .order('day_of_week');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const { schedule } = await req.json(); // array of { day_of_week, start_time, end_time, is_working }
  const supabase = await createServerClient(true);

  // Upsert all 7 days
  const rows = (schedule as Array<{ day_of_week: number; start_time: string; end_time: string; is_working: boolean }>).map(s => ({
    employee_id: parseInt(id),
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    is_working: s.is_working,
  }));

  const { data, error } = await supabase
    .from('work_schedules')
    .upsert(rows, { onConflict: 'employee_id,day_of_week' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
