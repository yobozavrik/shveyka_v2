import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin('public');

  const { data: entry, error: fetchError } = await supabaseAdmin
    .from('operation_entries')
    .select('employee_id, status')
    .eq('id', id)
    .single();

  if (fetchError || !entry) {
    return NextResponse.json({ error: 'Запис не знайдено' }, { status: 404 });
  }

  if (entry.employee_id !== user.userId && entry.employee_id !== user.employeeId) {
    return NextResponse.json({ error: 'Ви не можете видалити чужий запис' }, { status: 403 });
  }

  if (entry.status !== 'submitted') {
    return NextResponse.json(
      { error: 'Можна видалити лише записи зі статусом "Очікує"' },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from('operation_entries')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
