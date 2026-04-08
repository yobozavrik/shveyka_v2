import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'in_progress';
  const limit = parseInt(searchParams.get('limit') || '50');

  const shveykaClient = getSupabaseAdmin('public');

  let query = shveykaClient
    .from('production_batches')
    .select(`
      id, batch_number, status, quantity, size_variants, is_urgent, priority,
      planned_start_date, planned_end_date, actual_start_date,
      fabric_type, fabric_color, notes, created_at,
      product_models(id, name, sku, category),
      employees!production_batches_supervisor_id_fkey(id, full_name)
    `)
    .order('is_urgent', { ascending: false })
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'active') {
    // Active = not yet shipped or cancelled
    query = query.in('status', ['created', 'cutting', 'sewing', 'ready']);
  } else {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Batches error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

