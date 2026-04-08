import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRole } from '@/lib/auth-server';

export async function GET() {
  const role = await getRole();
  if (!['admin', 'manager', 'master'].includes(role || '')) {
    return NextResponse.json({ message: 'Доступ заборонено' }, { status: 403 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('operation_entries')
    .select(`
      *,
      employees(full_name),
      production_batches(batch_number),
      operations(name, base_rate)
    `)
    .eq('status', 'submitted')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const role = await getRole();
  if (!['admin', 'master'].includes(role || '')) {
    return NextResponse.json({ message: 'Доступ заборонено' }, { status: 403 });
  }

  const { id, status } = await request.json();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('operation_entries')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data);
}
