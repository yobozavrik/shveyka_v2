import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const supabase = await createServerClient(true);

    // 1. Загружаем ВСЕХ активных сотрудников с их ролями
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select(`
        id,
        full_name,
        position,
        status,
        users ( role )
      `)
      .eq('status', 'active');

    if (empError) return ApiResponse.handle(empError, 'payroll_summary');

    // Инициализируем карту для каждого сотрудника (даже если нет выработки)
    const summaryMap = new Map<number, any>();
    if (employees) {
      for (const emp of employees) {
        const roleData = Array.isArray(emp.users) ? emp.users[0] : emp.users;
        summaryMap.set(emp.id, {
          id: emp.id,
          name: emp.full_name,
          role: roleData?.role || 'worker',
          position: emp.position || '—',
          department: '',
          totalQty: 0,
          totalAmount: 0,
          entryCount: 0
        });
      }
    }

    // 2. Загружаем подтвержденные записи
    const { data: entries, error: entriesError } = await supabase
      .from('task_entries')
      .select('employee_id, quantity, operation_id')
      .eq('status', 'approved');

    if (entriesError) return ApiResponse.handle(entriesError, 'payroll_summary');

    if (entries && entries.length > 0) {
      // 3. Загружаем ставки операций
      const opIds = [...new Set(entries.map(e => e.operation_id).filter(Boolean))];
      let rateMap = new Map<number, number>();

      if (opIds.length > 0) {
        const { data: stageOps } = await supabase
          .from('stage_operations')
          .select('id, code')
          .in('id', opIds);

        if (stageOps) {
          const codes = stageOps.map(op => op.code);
          const { data: ops } = await supabase
            .from('operations')
            .select('code, base_rate')
            .in('code', codes);

          if (ops) {
            const rateByCode = new Map(ops.map(o => [o.code, o.base_rate || 0]));
            stageOps.forEach(sOp => {
              rateMap.set(sOp.id, rateByCode.get(sOp.code) || 0);
            });
          }
        }
      }

      // 4. Суммируем выработку по сотрудникам
      for (const entry of entries) {
        const empData = summaryMap.get(entry.employee_id);
        if (empData) {
          const qty = Number(entry.quantity || 0);
          const rate = Number(rateMap.get(entry.operation_id) || 0);

          empData.totalQty += qty;
          empData.totalAmount += qty * rate;
          empData.entryCount += 1;
        }
      }
    }

    return ApiResponse.success(Array.from(summaryMap.values()));
  } catch (e: any) {
    return ApiResponse.handle(e, 'payroll_summary');
  }
}
