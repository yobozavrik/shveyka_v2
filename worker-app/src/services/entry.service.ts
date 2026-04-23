import { getSupabaseAdmin } from '@/lib/supabase';

export class EntryService {
  static async delete(id: number, user: any) {
    const supabase = getSupabaseAdmin('shveyka');

    const { data: entry, error: fetchError } = await supabase
      .from('operation_entries')
      .select('employee_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      return { success: false, error: 'Запис не знайдено', status: 404 };
    }

    // Check ownership
    const isOwner = entry.employee_id === user.userId || entry.employee_id === user.employeeId;
    const isPrivileged = ['admin', 'manager', 'master'].includes((user.role || '').toLowerCase());

    if (!isOwner && !isPrivileged) {
      return { success: false, error: 'Ви не можете видалити чужий запис', status: 403 };
    }

    if (entry.status !== 'submitted' && !isPrivileged) {
      return { 
        success: false, 
        error: 'Можна видалити лише записи зі статусом "Очікує"', 
        status: 400 
      };
    }

    const { error: deleteError } = await supabase
      .from('operation_entries')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return { success: false, error: deleteError.message, status: 500 };
    }

    return { success: true };
  }
}
