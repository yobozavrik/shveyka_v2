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
    const status = searchParams.get('status');

    const supabase = await createServerClient(true);
    let query = supabase
      .from('vacancies')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error fetching vacancies:', error);
      return NextResponse.json({ 
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Vacancies GET exception:', e);
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

    const vacancyData = {
      title: body.title,
      description: body.description,
      requirements: body.requirements || {},
      status: body.status || 'open',
    };

    const { data, error } = await supabase
      .from('vacancies')
      .insert([vacancyData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating vacancy:', error);
      return NextResponse.json({ 
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      }, { status: 500 });
    }

    // Record audit log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      recordAuditLog({
        action: 'CREATE',
        entityType: 'vacancy',
        entityId: data.id.toString(),
        newData: data,
        request,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Vacancies POST exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
