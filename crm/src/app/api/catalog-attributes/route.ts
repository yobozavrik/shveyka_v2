import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

function normalizeKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '_')
    .replace(/^_+|_+$/g, '');
}

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');

  const supabase = await createServerClient(true);
  let query = supabase
    .from('catalog_attribute_definitions')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (scope) {
    query = query.eq('scope', scope);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const key = normalizeKey(body.key || body.label || '');

  if (!key || !body.label) {
    return NextResponse.json({ error: 'key and label are required' }, { status: 400 });
  }

  const supabase = await createServerClient(true);
  const { data, error } = await supabase
    .from('catalog_attribute_definitions')
    .insert({
      key,
      label: body.label,
      description: body.description || null,
      value_type: body.value_type || 'text',
      scope: body.scope || 'model',
      source: body.source || 'manual',
      is_required: body.is_required ?? false,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
      config: body.config || {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
