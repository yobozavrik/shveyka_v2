import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const shveykaClient = getSupabaseAdmin('shveyka');

  const { data, error } = await shveykaClient
    .from('cutting_nastils')
    .select('*, employees(id, full_name)')
    .eq('batch_id', parseInt(id))
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Nastils fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const shveykaClient = getSupabaseAdmin('shveyka');

  const { data, error } = await shveykaClient
    .from('cutting_nastils')
    .insert({
      batch_id: parseInt(id),
      employee_id: user.employeeId,
      nastil_name: body.nastil_name,
      age_group: body.age_group || 'adult',
      sizes_json: body.sizes_json || [],
      total_qty: body.total_qty || 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Nastil insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
