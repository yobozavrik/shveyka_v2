import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: 'Invalid entry id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const supabase = await createServerClient(true);

  const { data: existing, error: fetchError } = await supabase
    .from('task_entries')
    .select('id, data')
    .eq('id', entryId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const mergedData = { ...(existing.data || {}), ...body.data };

  const { data, error } = await supabase
    .from('task_entries')
    .update({ data: mergedData, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .select('id, data, notes, recorded_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
