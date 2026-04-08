import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

const ALLOWED_ROLES = ['admin', 'manager', 'hr', 'production_head'];

type Params = { params: Promise<{ id: string }> };

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const positionId = Number(id);
  if (!Number.isFinite(positionId)) {
    return NextResponse.json({ error: 'Некоректний ідентифікатор' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = normalizeString(body.name);
  const shveyka = await createServerClient(true);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = name;
  if (body.sort_order !== undefined) {
    updates.sort_order =
      body.sort_order === null || body.sort_order === '' ? 0 : Number(body.sort_order);
  }
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;

  if ('name' in updates && !updates.name) {
    return NextResponse.json({ error: 'Вкажіть назву посади' }, { status: 400 });
  }

  const { data, error } = await shveyka
    .from('positions')
    .update(updates)
    .eq('id', positionId)
    .select('id, name, is_active, sort_order, created_at, updated_at')
    .single();

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Довідник посад ще не створений у базі. Застосуйте міграцію `20260406_positions_directory_shveyka.sql`.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const positionId = Number(id);
  if (!Number.isFinite(positionId)) {
    return NextResponse.json({ error: 'Некоректний ідентифікатор' }, { status: 400 });
  }

  const shveyka = await createServerClient(true);
  const { data, error } = await shveyka
    .from('positions')
    .update({ is_active: false })
    .eq('id', positionId)
    .select('id, name, is_active, sort_order, created_at, updated_at')
    .single();

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Довідник посад ще не створений у базі. Застосуйте міграцію `20260406_positions_directory_shveyka.sql`.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
