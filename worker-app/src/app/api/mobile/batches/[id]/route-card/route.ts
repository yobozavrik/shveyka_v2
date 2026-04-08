import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const batchId = parseInt(id);
  const { route_card_id } = await request.json();

  if (!batchId || !route_card_id) {
    return NextResponse.json({ error: 'Невірні параметри' }, { status: 400 });
  }

  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let isPrivileged = ['master', 'supervisor', 'admin', 'administrator'].includes((user.role || '').toLowerCase());
  
  if (!isPrivileged && user.employeeId) {
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('position, full_name')
      .eq('id', user.employeeId)
      .single();
    
    if (emp) {
      const pos = (emp.position || '').toLowerCase();
      const name = (emp.full_name || '').toLowerCase();
      // Added more variations for 'master' and specific check for Marina
      if (['майстер', 'мастер', 'адміністратор', 'администратор', 'бригадир', 'master'].includes(pos) || 
          name.includes('марина') || name.includes('koval')) {
        isPrivileged = true;
      }
    }
  }

  if (!isPrivileged) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get current status to decide if we should update it
  const { data: currentBatch } = await supabaseAdmin
    .from('production_batches')
    .select('status')
    .eq('id', batchId)
    .single();

  const updateData: any = { 
    route_card_id, 
    updated_at: new Date().toISOString() 
  };
  
  // Auto-transition from created to cutting
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
