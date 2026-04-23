import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

const MASTER_POSITIONS = ['майстер', 'мастер', 'адміністратор', 'администратор', 'бригадир', 'менеджер', 'master'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const batchId = parseInt(id);
  const { route_card_id } = await request.json();

  if (!batchId || !route_card_id) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let isPrivileged = ['master', 'supervisor', 'admin', 'administrator'].includes((user.role || '').toLowerCase());
  const supabaseAdmin = getSupabaseAdmin('shveyka');
  
  if (!isPrivileged && user.employeeId) {
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('position, full_name')
      .eq('id', user.employeeId)
      .single();
    
    if (emp) {
      const pos = (emp.position || '').toLowerCase();
      if (MASTER_POSITIONS.some(p => pos.includes(p))) {
        isPrivileged = true;
      }
    }
  }

  if (!isPrivileged) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: currentBatch } = await supabaseAdmin
    .from('production_batches')
    .select('status')
    .eq('id', batchId)
    .single();

  const updateData: any = { 
    route_card_id, 
    updated_at: new Date().toISOString() 
  };
  
  if (currentBatch?.status === 'created') {
    updateData.status = 'cutting';
  }

  const { data, error } = await supabaseAdmin
    .from('production_batches')
    .update(updateData)
    .eq('id', batchId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true, batch: data });
}
