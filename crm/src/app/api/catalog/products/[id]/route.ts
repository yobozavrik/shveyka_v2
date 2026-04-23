import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Next.js 15 требует await для params
    const supabase = await createServerClient();
    
    // Получаем модель
    const { data: product, error: prodError } = await supabase
      .from('product_models')
      .select('*, product_categories(name)')
      .eq('id', id)
      .single();

    if (prodError) throw prodError;

    // Получаем все варианты (размеры/артикулы)
    const { data: variants, error: varError } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_model_id', id)
      .order('size', { ascending: true });

    if (varError) throw varError;

    return NextResponse.json({
      ...product,
      variants: variants || []
    });
  } catch (error: any) {
    console.error('Product Detail API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
