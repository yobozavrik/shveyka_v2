import { createServerClient } from '@/lib/supabase/server';

export class EntryService {
  static async getById(id: number, auth: any) {
    const supabase = await createServerClient(true);
    
    const { data: entry, error } = await supabase
      .from('task_entries')
      .select('*, employees(full_name), stage_operations(code)')
      .eq('id', id)
      .single();

    if (error || !entry) return { success: false, error: 'Entry not found', status: 404 };

    if (entry.employee_id !== auth.employeeId && !['admin', 'manager', 'master'].includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    return { success: true, data: entry };
  }

  static async update(id: number, body: any, auth: any) {
    const supabase = await createServerClient(true);

    const { data: existing, error: fetchError } = await supabase
      .from('task_entries')
      .select('id, data, employee_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) return { success: false, error: 'Entry not found', status: 404 };

    if (existing.employee_id !== auth.employeeId && !['admin', 'manager'].includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    const mergedData = { ...(existing.data || {}), ...body.data };

    const { data, error } = await supabase
      .from('task_entries')
      .update({ 
        data: mergedData, 
        notes: body.notes !== undefined ? body.notes : undefined,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select('id, data, notes, recorded_at, updated_at')
      .single();

    if (error) return { success: false, error: error.message, status: 500 };

    return { success: true, data };
  }

  static async delete(id: number, auth: any) {
    const supabase = await createServerClient(true);

    const { data: existing, error: fetchError } = await supabase
      .from('task_entries')
      .select('id, employee_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) return { success: false, error: 'Entry not found', status: 404 };

    // Only owners can delete their draft entries, or managers can delete any
    if (existing.employee_id !== auth.employeeId && !['admin', 'manager'].includes(auth.role)) {
      return { success: false, error: 'Forbidden', status: 403 };
    }

    if (existing.status !== 'submitted' && !['admin', 'manager'].includes(auth.role)) {
      return { success: false, error: 'Cannot delete approved entry', status: 400 };
    }

    const { error } = await supabase
      .from('task_entries')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message, status: 500 };

    return { success: true };
  }
}
