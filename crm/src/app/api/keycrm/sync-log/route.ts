import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient(true);
    const { data, error } = await supabase
      .from('keycrm_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[KeyCRM SyncLog] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('[KeyCRM SyncLog] Exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
