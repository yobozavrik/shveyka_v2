import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId');
  const search = searchParams.get('search');

  try {
    const supabase = await createServerClient();
    
    let query = supabase
      .from('product_models')
      .select('*, product_categories(name)')
      .order('name');

    if (categoryId) {
      const { data: allCategories } = await supabase
        .from('product_categories')
        .select('id, parent_id');

      const getChildIds = (id: number, list: any[]): number[] => {
        const ids = [id];
        const children = list.filter(c => c.parent_id === id);
        for (const child of children) {
          ids.push(...getChildIds(child.id, list));
        }
        return ids;
      };

      const categoryIds = getChildIds(Number(categoryId), allCategories || []);
      query = query.in('category_id', categoryIds);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Catalog Products API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
