import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('model_id');
  const quantity = parseInt(searchParams.get('quantity') || '1');

  if (!modelId) return NextResponse.json({ error: 'model_id обовʼязковий' }, { status: 400 });

  const supabase = await createServerClient(true);

  // Get norms for model
  const { data: norms } = await supabase
    .from('material_norms')
    .select('*, materials(id, name, code, unit, current_stock)')
    .eq('product_model_id', parseInt(modelId));

  if (!norms || norms.length === 0) {
    return NextResponse.json({ sufficient: true, message: 'Норми не задані', items: [] });
  }

  const items = norms.map((n: { quantity_per_unit: number; materials: { id: number; name: string; current_stock: number; unit: string } }) => {
    const needed = n.quantity_per_unit * quantity;
    const available = n.materials?.current_stock || 0;
    return {
      material: n.materials,
      needed,
      available,
      deficit: Math.max(0, needed - available),
      sufficient: available >= needed,
    };
  });

  const allSufficient = items.every((i: { sufficient: boolean }) => i.sufficient);

  return NextResponse.json({
    sufficient: allSufficient,
    items,
  });
}
