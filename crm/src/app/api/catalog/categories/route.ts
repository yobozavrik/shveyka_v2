import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: categories, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('name');

    if (error) throw error;

    const buildTree = (items: any[], parentId: number | null = null): any[] => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }));
    };

    const tree = buildTree(categories || []);
    return NextResponse.json(tree);
  } catch (error: any) {
    console.error('Catalog Categories API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
