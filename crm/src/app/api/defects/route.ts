import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const supabase = await createServerClient();

    // Мы используем упрощенный селект для начала диагностики
    let query = supabase
      .from('defects')
      .select('*')
      .order('created_at', { ascending: false });

    const batchId = searchParams.get('batch_id');
    const employeeId = searchParams.get('employee_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (batchId) query = query.eq('production_batch_id', parseInt(batchId));
    if (employeeId) query = query.eq('employee_id', parseInt(employeeId));
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error Defects GET:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('Defects GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'master', 'quality'].includes(auth.role)) {
      return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('defects')
      .insert({
        production_batch_id: body.production_batch_id,
        operation_id: body.operation_id || null,
        employee_id: body.employee_id || null,
        quantity: body.quantity || 1,
        defect_type: body.defect_type || 'minor', // Используем defect_type вместо severity
        defect_reason: body.defect_reason || body.description || '',
        decision: body.decision || 'rework',
        description: body.description || '',
        detected_by: auth.userId, // Автоматически ставим того, кто нашел
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error Defects POST:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('Defects POST exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
