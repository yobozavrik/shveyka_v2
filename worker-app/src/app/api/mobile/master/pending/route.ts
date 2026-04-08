import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shveykaClient = getSupabaseAdmin('public');

  let isPrivileged = ['master', 'supervisor', 'admin', 'manager'].includes((user.role || '').toLowerCase());

  if (!isPrivileged && user.employeeId) {
    const { data: emp } = await shveykaClient
      .from('employees')
      .select('full_name, position')
      .eq('id', user.employeeId)
      .limit(1)
      .single();
    
    if (emp) {
      const pos = (emp.position || '').toLowerCase();
      const name = (emp.full_name || '').toLowerCase();
      if (
        ['майстер', 'мастер', 'адміністратор', 'администратор', 'бригадир', 'менеджер'].some(p => pos.includes(p)) ||
        name.includes('марина коваль')
      ) {
        isPrivileged = true;
      }
    }
  }

  if (!isPrivileged) {
    return NextResponse.json({ error: 'Недостатньо прав' }, { status: 403 });
  }

  const { data, error } = await shveykaClient
    .from('operation_entries')
    .select(`
      id, quantity, size, status, entry_date, entry_time, notes, created_at,
      employees(id, full_name, position),
      operations(id, name, code, base_rate),
      production_batches(id, batch_number, product_models(id, name))
    `)
    .eq('status', 'submitted')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Master pending fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}
