import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const vacancyId = searchParams.get('vacancyId');
    const status = searchParams.get('status');

    const supabase = await createServerClient(true);
    let query = supabase
      .from('candidates')
      .select('*, vacancies(title)')
      .order('created_at', { ascending: false });

    if (vacancyId) query = query.eq('vacancy_id', vacancyId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error fetching candidates:', error);
      return NextResponse.json({ 
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const candidateData = {
      vacancy_id: body.vacancy_id,
      full_name: body.full_name,
      phone: body.phone || null,
      resume_text: body.resume_text || null,
      status: body.status || 'applied',
      ai_score: body.ai_score || null,
      ai_analysis: body.ai_analysis || null,
    };

    const { data, error } = await supabase
      .from('candidates')
      .insert([candidateData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating candidate:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record audit log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      recordAuditLog({
        action: 'CREATE',
        entityType: 'candidate',
        entityId: data.id.toString(),
        newData: data,
        request: request,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Candidates POST exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
