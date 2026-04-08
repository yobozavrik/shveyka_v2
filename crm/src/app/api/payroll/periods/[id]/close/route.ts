import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createServerClient();

  // Check period exists and is open
  const { data: period } = await supabase
    .from('payroll_periods')
    .select('status')
    .eq('id', parseInt(id))
    .single();

  if (!period) return NextResponse.json({ error: 'Період не знайдено' }, { status: 404 });
  if (period.status === 'closed') return NextResponse.json({ error: 'Період вже закритий' }, { status: 400 });

  const { data, error } = await supabase
    .from('payroll_periods')
    .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: auth.userId })
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
