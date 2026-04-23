import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/mobile/notifications/count
 * Returns count of pending tasks for the current user's role.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (user.role || '').toLowerCase();
  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin('shveyka');

  // Count all pending tasks for this role
  const { count: pendingCount, error: pendingError } = await supabase
    .from('batch_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('assigned_role', role);

  if (pendingError) {
    console.error('Notification count error:', pendingError);
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  // Debug logging
  console.log(`[notifications/count] role=${role}, pendingCount=${pendingCount || 0}`);

  // Count urgent pending tasks for this role
  const { data: pendingTasks, error: tasksError } = await supabase
    .from('batch_tasks')
    .select('batch_id')
    .eq('status', 'pending')
    .eq('assigned_role', role);

  let urgentCount = 0;
  if (pendingTasks && pendingTasks.length > 0) {
    const batchIds = pendingTasks.map((t: any) => t.batch_id).filter(Boolean);
    if (batchIds.length > 0) {
      const { data: urgentBatches, error: urgentError } = await supabase
        .from('production_batches')
        .select('id')
        .in('id', batchIds)
        .eq('is_urgent', true);

      if (!urgentError && urgentBatches) {
        urgentCount = urgentBatches.length;
      }
    }
  }

  return NextResponse.json({
    pending_tasks: pendingCount || 0,
    urgent_tasks: urgentCount,
  });
}
