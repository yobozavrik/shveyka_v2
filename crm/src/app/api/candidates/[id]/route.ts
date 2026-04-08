import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data: candidate, error } = await supabase
      .from('candidates')
      .select('*, vacancies(*)')
      .eq('id', parseInt(id))
      .single();

    if (error || !candidate) {
      return NextResponse.json({ error: error?.message || 'Не знайдено' }, { status: 404 });
    }

    return NextResponse.json(candidate);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'hr'].includes(auth.role)) {
      return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = await createServerClient(true);

    const { data: oldData } = await supabase.from('candidates').select('*').eq('id', parseInt(id)).single();

    const allowed = ['full_name', 'phone', 'resume_text', 'status', 'ai_score', 'ai_analysis'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const { data, error } = await supabase
      .from('candidates')
      .update(update)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Record audit log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      recordAuditLog({
        action: 'UPDATE',
        entityType: 'candidate',
        entityId: id,
        oldData,
        newData: data,
        request: req,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data: oldData } = await supabase.from('candidates').select('*').eq('id', parseInt(id)).single();

    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', parseInt(id));

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Record audit log
    try {
      const { recordAuditLog } = await import('@/lib/audit');
      recordAuditLog({
        action: 'DELETE',
        entityType: 'candidate',
        entityId: id,
        oldData,
        newData: null,
        request: req,
        auth: { id: auth.userId, username: auth.username }
      });
    } catch (auditError) {
      console.warn('Failed to record audit log:', auditError);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
