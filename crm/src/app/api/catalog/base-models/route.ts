import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId');

  try {
    const supabase = await createServerClient();
    let query = supabase
      .from('base_models')
      .select('*')
      .order('name');

    if (categoryId) {
      // Рекурсивный поиск категорий (как в продуктах)
      const { data: allCats } = await supabase.from('product_categories').select('id, parent_id');
      const getChildIds = (id: number, list: any[]): number[] => {
        const ids = [id];
        list.filter(c => c.parent_id === id).forEach(c => ids.push(...getChildIds(c.id, list)));
        return ids;
      };
      const ids = getChildIds(Number(categoryId), allCats || []);
      query = query.in('category_id', ids);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
