import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const empId = parseInt(id);
  const supabase = await createServerClient(true);

  const { data, error } = await supabase
    .from('employee_absences')
    .select('*')
    .eq('employee_id', empId)
    .order('start_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const empId = parseInt(id);
  const body = await request.json();
  const supabase = await createServerClient(true);

  const { data, error } = await supabase
    .from('employee_absences')
    .insert({
      employee_id: empId,
      type: body.type,
      start_date: body.start_date,
      end_date: body.end_date,
      notes: body.notes,
      status: body.status || 'approved'
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
