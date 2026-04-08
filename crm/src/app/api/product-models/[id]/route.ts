import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !['admin', 'manager'].includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerClient(true);

  const allowed = ['name', 'sku', 'description', 'sizes', 'is_active', 'thumbnail_url'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const modelId = parseInt(id);
  const { data: oldData } = await supabase.from('product_models').select('*').eq('id', modelId).single();

  const { data, error } = await supabase
    .from('product_models')
    .update(update)
    .eq('id', modelId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ЗАПИС В ЖУРНАЛ АУДИТУ
  if (auth) {
    const { recordAuditLog } = await import('@/lib/audit');
    recordAuditLog({
      action: 'UPDATE',
      entityType: 'model',
      entityId: id,
      oldData,
      newData: data,
      request: req,
      auth: { id: auth.userId, username: auth.username }
    });
  }

  return NextResponse.json(data);
}
