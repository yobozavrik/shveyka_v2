import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shveykaClient = getSupabaseAdmin('shveyka');

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
        ['майстер', 'мастер', 'адміністратор', 'администратор', 'бригадир', 'менеджер'].some(p => pos.includes(p))
      ) {
        isPrivileged = true;
      }
    }
  }

  if (!isPrivileged) {
    return NextResponse.json({ error: 'Недостатньо прав' }, { status: 403 });
  }

  const { entry_id, action, comment } = await request.json();

  if (!entry_id || !['confirm', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Невірні параметри' }, { status: 400 });
  }

  const newStatus = action === 'confirm' ? 'approved' : 'rejected';

  const { data, error } = await shveykaClient
    .from('operation_entries')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', entry_id)
    .eq('status', 'submitted')
    .select()
    .single();

  if (error) {
    console.error('Approve update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Запис не знайдено або вже оброблено' }, { status: 404 });

  // --- Автоматичне закриття партії (Workflow Completion) ---
  if (action === 'confirm') {
    try {
      // 1. Отримуємо інфо про партію та її маршрутну карту
      const { data: batch } = await shveykaClient
        .from('production_batches')
        .select('id, quantity, route_card_id')
        .eq('id', (data as any).production_batch_id)
        .single();
      
      if (batch?.route_card_id) {
        // 2. Знаходимо останню операцію в маршруті
        const { data: lastOp } = await shveykaClient
          .from('route_card_operations')
          .select('operation_id, sequence_number')
          .eq('route_card_id', batch.route_card_id)
          .order('sequence_number', { ascending: false })
          .limit(1)
          .single();
        
        // 3. Якщо це була остання операція — перевіряємо готовність 100%
        if (lastOp && lastOp.operation_id === (data as any).operation_id) {
          const { data: totalConfirmedData } = await shveykaClient
            .from('operation_entries')
            .select('quantity')
            .eq('production_batch_id', batch.id)
            .eq('operation_id', lastOp.operation_id)
            .eq('status', 'approved');
          
          const totalConfirmed = (totalConfirmedData as any[] || []).reduce((sum, item) => sum + item.quantity, 0);
          
          if (totalConfirmed >= batch.quantity) {
            // ФІНАЛ: Переводимо партію в статус ready
            await shveykaClient
              .from('production_batches')
              .update({ status: 'ready', updated_at: new Date().toISOString() })
              .eq('id', batch.id);
          }
        }
      }
    } catch (err) {
      console.error('Workflow completion error:', err);
    }
  }

  // Log approval to persistent audit log
  try {
    const { recordAuditLog } = await import('@/lib/audit');
    await recordAuditLog({
      action: action === 'confirm' ? 'APPROVE' : 'REJECT',
      entityType: 'operation_entry',
      entityId: entry_id.toString(),
      oldData: { status: 'submitted' },
      newData: data,
      request,
      auth: { 
        userId: user.userId, 
        username: user.username, 
        employeeId: user.employeeId 
      }
    });
  } catch (auditErr) {
    console.error('Non-critical audit log failure:', auditErr);
  }

  return NextResponse.json({ success: true, status: newStatus, entry: data });
}
