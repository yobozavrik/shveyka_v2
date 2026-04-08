import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerClient();

  const update: Record<string, unknown> = {};
  if (body.absence_type !== undefined) update.absence_type = body.absence_type;
  if (body.date_from !== undefined) update.date_from = body.date_from;
  if (body.date_to !== undefined) update.date_to = body.date_to;
  if (body.reason !== undefined) update.reason = body.reason;

  const { data, error } = await supabase
    .from('employee_absences')
    .update(update)
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('employee_absences')
    .delete()
    .eq('id', parseInt(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
