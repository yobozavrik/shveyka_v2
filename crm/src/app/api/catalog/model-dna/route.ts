import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseModelId = searchParams.get('baseModelId');

  if (!baseModelId) return NextResponse.json({ error: 'Missing baseModelId' }, { status: 400 });

  try {
    const supabase = await createServerClient();
    
    // Получаем все "Исполнения" для этой базовой модели
    const { data: variants, error } = await supabase
      .from('product_models')
      .select('design_name, fabric_type, fabric_color, embroidery_info, id, name')
      .eq('base_model_id', baseModelId);

    if (error) throw error;

    // Группируем для удобства фронтенда
    const dna = {
      designs: Array.from(new Set(variants.map(v => v.design_name).filter(Boolean))),
      fabrics: Array.from(new Set(variants.map(v => v.fabric_type).filter(Boolean))),
      colors: Array.from(new Set(variants.map(v => v.fabric_color).filter(Boolean))),
      raw: variants
    };

    return NextResponse.json(dna);
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
