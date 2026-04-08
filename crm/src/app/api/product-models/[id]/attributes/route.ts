import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const modelId = parseInt(id, 10);
  if (Number.isNaN(modelId)) {
    return NextResponse.json({ error: 'Invalid model id' }, { status: 400 });
  }

  const supabase = await createServerClient(true);
  const [{ data: definitions, error: defError }, { data: values, error: valueError }] = await Promise.all([
    supabase
      .from('catalog_attribute_definitions')
      .select('*')
      .eq('scope', 'model')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true }),
    supabase
      .from('catalog_attribute_values')
      .select('*')
      .eq('product_model_id', modelId),
  ]);

  if (defError) return NextResponse.json({ error: defError.message }, { status: 500 });
  if (valueError) return NextResponse.json({ error: valueError.message }, { status: 500 });

  const byDefinitionId = new Map((values || []).map(value => [value.attribute_definition_id, value]));

  return NextResponse.json(
    (definitions || []).map(definition => ({
      definition,
      value: byDefinitionId.get(definition.id) || null,
    })),
  );
}

export async function POST(request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager', 'technologist'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const modelId = parseInt(id, 10);
  if (Number.isNaN(modelId)) {
    return NextResponse.json({ error: 'Invalid model id' }, { status: 400 });
  }

  const body = await request.json();
  const items = Array.isArray(body.attributes) ? body.attributes : [];
  if (items.length === 0) {
    return NextResponse.json({ error: 'attributes are required' }, { status: 400 });
  }

  const supabase = await createServerClient(true);
  const rows = items.map((item: Record<string, unknown>) => ({
    product_model_id: modelId,
    attribute_definition_id: item.attribute_definition_id,
    value_text: item.value_text ?? null,
    value_number: item.value_number ?? null,
    value_boolean: item.value_boolean ?? null,
    value_date: item.value_date ?? null,
    value_json: item.value_json ?? null,
  }));

  const { data, error } = await supabase
    .from('catalog_attribute_values')
    .upsert(rows, { onConflict: 'product_model_id,attribute_definition_id' })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
