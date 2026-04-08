import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createServerClient(true);

  const { data: doc } = await supabase
    .from('supply_documents')
    .select('status')
    .eq('id', parseInt(id))
    .single();

  if (!doc) return NextResponse.json({ error: 'Не знайдено' }, { status: 404 });
  if (doc.status !== 'draft') return NextResponse.json({ error: 'Скасувати можна тільки draft' }, { status: 400 });

  const { data, error } = await supabase
    .from('supply_documents')
    .update({ status: 'cancelled' })
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
