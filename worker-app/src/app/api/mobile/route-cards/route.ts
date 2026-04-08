import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shveykaClient = getSupabaseAdmin('public');

  let isPrivileged = ['master', 'supervisor', 'admin', 'administrator', 'manager'].includes((user.role || '').toLowerCase());
  
  if (!isPrivileged && user.employeeId) {
    const { data: emp } = await shveykaClient
      .from('employees')
      .select('position, full_name')
      .eq('id', user.employeeId)
      .limit(1)
      .single();
    
    if (emp) {
      const pos = (emp.position || '').toLowerCase();
      const name = (emp.full_name || '').toLowerCase();
      if (['майстер', 'мастер', 'адміністратор', 'администратор', 'бригадир', 'менеджер'].includes(pos) || 
          name.includes('марина коваль')) {
        isPrivileged = true;
      }
    }
  }

  if (!isPrivileged) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await shveykaClient
    .from('route_cards')
    .select(`
      id, version, description,
      product_models(id, name, sku)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Route cards fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}
