import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = await createServerClient(true);

    // 1. Fetch Candidate data
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('*, vacancies(title)')
      .eq('id', parseInt(id))
      .single();

    if (candError || !candidate) {
      return NextResponse.json({ error: 'Кандидата не знайдено' }, { status: 404 });
    }

    // 2. Create Employee record
    const employeeData = {
      full_name: candidate.full_name,
      phone: candidate.phone || null,
      position: body.position || candidate.vacancies?.title || 'Швея',
      department: body.department || 'Цех',
      payment_type: body.payment_type || 'piecework',
      status: 'active',
      hire_date: new Date().toISOString().split('T')[0],
      comments: `Прийнято через AI-рекрутинг. AI Score: ${candidate.ai_score || 'N/A'}`
    };

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .insert([employeeData])
      .select()
      .single();

    if (empError) {
      console.error('Hiring Error (Employee Create):', empError);
      return NextResponse.json({ error: `Ми не змогли створити картку працівника: ${empError.message}` }, { status: 500 });
    }

    // 3. Update Candidate status
    await supabase
      .from('candidates')
      .update({ status: 'hired' })
      .eq('id', parseInt(id));

    // 4. Record Audit Log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      recordAuditLog({
        action: 'CREATE',
        entityType: 'employee_from_candidate',
        entityId: employee.id.toString(),
        newData: employee,
        request: req,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Audit Log Error:', auditError);
    }

    return NextResponse.json({
      success: true,
      employeeId: employee.id,
      message: 'Кандидата успішно зараховано до штату'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
