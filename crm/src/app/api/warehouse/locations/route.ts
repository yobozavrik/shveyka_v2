import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient(true);
    const { searchParams } = new URL(request.url);
    const locationType = searchParams.get('type');

    let query = supabase
      .from('locations')
      .select('id, parent_id, name, type')
      .order('name');

    if (locationType) {
      query = query.eq('type', locationType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error fetching locations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('Locations GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
