import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'master'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();
  const validStatuses = ['created', 'cutting', 'in_progress', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Невірний статус' }, { status: 400 });
  }

  const supabase = await createServerClient(true);
  const { data, error } = await supabase
    .from('production_batches')
    .update({ status })
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
