import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRole } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const role = await getRole();
    if (!['admin', 'manager'].includes(role || '')) {
      return NextResponse.json({ message: 'Доступ заборонено' }, { status: 403 });
    }

    const supabase = await createServerClient(true);
    
    let query = supabase
      .schema('public')
      .from('operation_entries')
      .select(`
        id,
        quantity,
        entry_date,
        created_at,
        employees:employee_id(id, full_name, position),
        operations:operation_id(id, name, base_rate, operation_type)
      `)
      .eq('status', 'approved');

    // Use entry_date for payroll as it matches what users expect for work period
    if (startDate) query = query.gte('entry_date', startDate);
    if (endDate) query = query.lte('entry_date', endDate);

    const { data, error } = await query;
    console.log(`[Payroll API] Found ${data?.length || 0} entries for range ${startDate} - ${endDate}`);

    if (error) {
      console.error('[Payroll API] Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) return NextResponse.json([]);

    const payroll: Record<string, any> = {};

    data.forEach((entry: any) => {
      // With explicit alias 'employees:employee_id', Supabase results are in entry.employees
      // It can be an array or a single object depending on the library version
      const employee = Array.isArray(entry.employees) ? entry.employees[0] : entry.employees;
      const operation = Array.isArray(entry.operations) ? entry.operations[0] : entry.operations;

      if (!employee || !operation) {
        // Detailed log for debugging if it still skips
        console.warn(`[Payroll] Entry ${entry.id} missing data. Employee: ${!!employee}, Operation: ${!!operation}`);
        return;
      }

      const empId = employee.id || entry.employee_id;
      if (!payroll[empId]) {
        payroll[empId] = {
          id: empId,
          full_name: employee.full_name || 'Невідомий',
          total: 0,
          count: 0,
          entries: []
        };
      }
      
      const rate = operation.base_rate || 0;
      const qty = entry.quantity || 0;
      const amount = qty * rate;

      payroll[empId].total += amount;
      payroll[empId].count += 1;
      
      // Keep property names consistent (frontend expects ent.operations.name)
      payroll[empId].entries.push({
        ...entry,
        employee,
        operations: operation, // Use plural to match frontend 'ent.operations.name'
        amount
      });
    });

    return NextResponse.json(Object.values(payroll));
  } catch (e: any) {
    console.error('[Payroll API] Global Exception:', e);
    return NextResponse.json({ error: e.message || 'Внутрішня помилка сервера при розрахунку зарплати' }, { status: 500 });
  }
}
