import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function POST() {
  try {
    const auth = await getAuth();
    if (!auth || auth.role !== 'admin') {
      return ApiResponse.error('Доступ дозволено лише адміністраторам', ERROR_CODES.FORBIDDEN, 403);
    }

    const supabase = await createServerClient(true);
    
    // Послідовне видалення для уникнення конфліктів FK
    const tables = [
      'payroll_accruals',
      'task_entries',
      'batch_tasks',
      'production_batches',
      'production_order_lines',
      'production_order_materials',
      'production_order_events',
      'production_orders',
      'clients'
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).delete().gt('id', 0);
      if (error) {
        return ApiResponse.handle(error, `admin_clear_production:${table}`);
      }
    }

    return ApiResponse.success({ success: true, message: 'Виробничі дані успішно очищено' });
  } catch (e: any) {
    return ApiResponse.handle(e, 'admin_clear_production');
  }
}
