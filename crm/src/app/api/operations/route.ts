import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth, getAuth } from '@/lib/auth-server';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('operations')
      .select('*')
      .order('operation_type')
      .order('name');

    if (error) {
      console.error('Supabase error fetching operations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('Operations GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('operations')
      .insert({
        code: body.code,
        name: body.name,
        operation_type: body.operation_type || 'sewing',
        base_rate: body.base_rate,
        time_norm_minutes: body.time_norm_minutes || null,
        complexity_coefficient: body.complexity_coefficient || 1.0,
        unit: body.unit || 'pcs',
        description: body.description || null,
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating operation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('Operations POST exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
