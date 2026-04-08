import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerClient(true);

  const { data, error } = await supabase
    .from('material_norms')
    .update({ quantity_per_unit: body.quantity_per_unit })
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createServerClient();

  const { error } = await supabase.from('material_norms').delete().eq('id', parseInt(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
