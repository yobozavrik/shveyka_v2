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
    .from('supply_documents')
    .select('*, suppliers(id, name), supply_items(*, items(id, name, sku, unit))')
    .eq('id', parseInt(id))
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Не знайдено' }, { status: 404 });
  return NextResponse.json(data);
}
