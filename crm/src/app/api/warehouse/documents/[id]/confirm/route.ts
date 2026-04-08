import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRole } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const role = await getRole();
  if (!['admin', 'manager'].includes(role || '')) {
    return NextResponse.json({ error: 'Без доступу' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createServerClient(true);

  // Call the Supabase RPC to securely confirm the document
  const { error } = await supabase.rpc('confirm_warehouse_document', {
    p_doc_id: parseInt(id),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
