import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shveykaClient = getSupabaseAdmin('shveyka');

  // Fetch operations from shveyka schema sorted by sort_order
  const { data: operations, error } = await shveykaClient
    .from('operations')
    .select('id, name, code, operation_type, base_rate, parent_id, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Config fetch error:', error);
  }

  // Standard sizes
  const sizes = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
    '42', '44', '46', '48', '50', '52', '54', '56',
    '80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140', '146', '152',
  ];

  const defect_types = [
    { value: 'fabric', label: 'Дефект тканини' },
    { value: 'sewing', label: 'Дефект пошиву' },
    { value: 'cutting', label: 'Дефект крою' },
    { value: 'accessory', label: 'Дефект фурнітури' },
    { value: 'other', label: 'Інше' },
  ];

  return NextResponse.json({
    operations: operations || [],
    sizes,
    defect_types,
  }, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
