import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { recordAuditLog } from '@/lib/audit';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return ApiResponse.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const candidateId = parseInt(id, 10);

    const supabase = await createServerClient(true);

    // 1. Get candidate data
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (candError || !candidate) {
      return ApiResponse.error('Кандидата не знайдено', ERROR_CODES.NOT_FOUND, 404);
    }

    // 2. Create employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .insert({
        full_name: candidate.full_name,
        phone: candidate.phone,
        position: candidate.applied_position,
        status: 'active',
        payment_type: 'piecework',
        hire_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (empError || !employee) {
      return ApiResponse.handle(empError, 'candidates_hire');
    }

    // 3. Update candidate status
    await supabase
      .from('candidates')
      .update({ status: 'hired', updated_at: new Date().toISOString() })
      .eq('id', candidateId);

    // 4. Audit log
    try {
      await recordAuditLog({
        action: 'CREATE',
        entityType: 'employee',
        entityId: employee.id.toString(),
        newData: employee,
        request,
        auth: { id: auth.userId, username: auth.username },
      });
    } catch (auditError) {
      console.warn('Audit Log Error:', auditError);
    }

    return ApiResponse.success({
      success: true,
      employeeId: employee.id,
      message: 'Кандидата успішно зараховано до штату'
    });
  } catch (e: any) {
    return ApiResponse.handle(e, 'candidates_hire');
  }
}
