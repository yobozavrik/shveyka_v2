import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { hashPassword } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'manager', 'hr', 'production_head'];

type Params = { params: Promise<{ id: string }> };

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: unknown) {
  const text = normalizeString(value);
  return text || null;
}

function buildEmployeeUpdate(body: Record<string, unknown>) {
  const allowed = [
    'full_name',
    'employee_number',
    'position',
    'phone',
    'status',
    'payment_type',
    'birth_date',
    'family_info',
    'address',
    'skill_level',
    'individual_coefficient',
  ];

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      if (key === 'individual_coefficient') {
        update[key] =
          body[key] === null || body[key] === ''
            ? null
            : Number(body[key]);
      } else {
        update[key] = normalizeNullableString(body[key]) ?? body[key];
      }
    }
  }
  return update;
}

function buildAccessUpdate(body: Record<string, unknown>) {
  return {
    username: normalizeNullableString(body.username),
    role: normalizeNullableString(body.role),
    pin: normalizeNullableString(body.pin),
    password: normalizeNullableString(body.password),
    is_active: typeof body.is_active === 'boolean' ? body.is_active : null,
  };
}

function extractAccess(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    is_active: user.is_active,
    has_pin: Boolean(user.hashed_pin),
    has_password: Boolean(user.hashed_password),
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

async function loadEmployee(employeeId: number) {
  const shveyka = await createServerClient(true);
  return shveyka
    .from('employees')
    .select(`
      *,
      users (
        id,
        username,
        role,
        is_active,
        hashed_pin,
        hashed_password,
        created_at,
        updated_at
      )
    `)
    .eq('id', employeeId)
    .single();
}

async function writeAccess(
  employeeId: number,
  body: Record<string, unknown>,
  currentEmployeeNumber: string | null,
  currentStatus: string,
  existingUser: any
) {
  const shveyka = await createServerClient(true);
  const access = buildAccessUpdate(body);
  const userRow = existingUser || null;
  const hasAccessChanges =
    access.username ||
    access.role ||
    access.pin ||
    access.password ||
    (userRow && access.is_active !== null);

  if (!hasAccessChanges && !userRow) {
    return { data: null, error: null };
  }

  if (userRow) {
    const updates: Record<string, unknown> = {};
    if (access.username) updates.username = access.username;
    if (access.role) updates.role = access.role;
    if (access.is_active !== null) updates.is_active = access.is_active;
    if (access.pin) updates.hashed_pin = await hashPassword(access.pin);
    if (access.password) updates.hashed_password = await hashPassword(access.password);

    if (Object.keys(updates).length === 0) {
      return { data: userRow, error: null };
    }

    return shveyka
      .from('users')
      .update(updates)
      .eq('employee_id', employeeId)
      .select('id, username, role, is_active, hashed_pin, hashed_password, created_at, updated_at')
      .single();
  }

  if (!access.role || !access.pin || !access.password) {
    return { data: null, error: null };
  }

  const username = access.username || currentEmployeeNumber || `employee-${employeeId}`;
  const [hashed_pin, hashed_password] = await Promise.all([
    hashPassword(access.pin),
    hashPassword(access.password),
  ]);

  return shveyka
    .from('users')
    .insert({
      username,
      role: access.role,
      employee_id: employeeId,
      hashed_pin,
      hashed_password,
      is_active: access.is_active ?? currentStatus === 'active',
    })
    .select('id, username, role, is_active, hashed_pin, hashed_password, created_at, updated_at')
    .single();
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'Некоректний ідентифікатор' }, { status: 400 });
  }

  const { data, error } = await loadEmployee(employeeId);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Не знайдено' }, { status: 404 });
  }

  return NextResponse.json({
    ...data,
    access: extractAccess(Array.isArray(data.users) ? data.users[0] : data.users),
    users: undefined,
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'Некоректний ідентифікатор' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const shveyka = await createServerClient(true);

  const { data: existing, error: loadError } = await loadEmployee(employeeId);
  if (loadError || !existing) {
    return NextResponse.json({ error: 'Співробітника не знайдено' }, { status: 404 });
  }

  const oldData = {
    ...existing,
    access: extractAccess(Array.isArray(existing.users) ? existing.users[0] : existing.users),
  };

  const employeeUpdate = buildEmployeeUpdate(body);
  const { data: employee, error: employeeError } = await shveyka
    .from('employees')
    .update(employeeUpdate)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (employeeError || !employee) {
    return NextResponse.json({ error: employeeError?.message || 'Не вдалося оновити співробітника' }, { status: 500 });
  }

  const currentUser = Array.isArray(existing.users) ? existing.users[0] : existing.users;
  const accessResult = await writeAccess(
    employeeId,
    body,
    employee.employee_number,
    employee.status,
    currentUser
  );

  if (accessResult.error) {
    return NextResponse.json({ error: accessResult.error.message }, { status: 500 });
  }

  const { data: refreshed } = await loadEmployee(employeeId);

  try {
    const { recordAuditLog } = await import('@/lib/audit');
    await recordAuditLog({
      action: 'UPDATE',
      entityType: 'employee',
      entityId: String(employeeId),
      oldData,
      newData: refreshed
        ? {
            ...refreshed,
            access: extractAccess(Array.isArray(refreshed.users) ? refreshed.users[0] : refreshed.users),
          }
        : employee,
      request: req,
      auth: { id: auth.userId, username: auth.username },
    });
  } catch (auditError) {
    console.error('Employee update audit error:', auditError);
  }

  return NextResponse.json(
    refreshed
      ? {
          ...refreshed,
          access: extractAccess(Array.isArray(refreshed.users) ? refreshed.users[0] : refreshed.users),
          users: undefined,
        }
      : employee
  );
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'Некоректний ідентифікатор' }, { status: 400 });
  }

  const shveyka = await createServerClient(true);
  const { data: existing, error: loadError } = await loadEmployee(employeeId);
  if (loadError || !existing) {
    return NextResponse.json({ error: 'Співробітника не знайдено' }, { status: 404 });
  }

  const { data: employee, error: employeeError } = await shveyka
    .from('employees')
    .update({ status: 'dismissed' })
    .eq('id', employeeId)
    .select('*')
    .single();

  if (employeeError || !employee) {
    return NextResponse.json({ error: employeeError?.message || 'Не вдалося деактивувати співробітника' }, { status: 500 });
  }

  await shveyka
    .from('users')
    .update({ is_active: false })
    .eq('employee_id', employeeId);

  try {
    const { recordAuditLog } = await import('@/lib/audit');
    await recordAuditLog({
      action: 'DELETE',
      entityType: 'employee',
      entityId: String(employeeId),
      oldData: existing,
      newData: employee,
      request: _req,
      auth: { id: auth.userId, username: auth.username },
    });
  } catch (auditError) {
    console.error('Employee delete audit error:', auditError);
  }

  return NextResponse.json(employee);
}
