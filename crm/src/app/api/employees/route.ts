import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { hashPassword } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'manager', 'hr', 'production_head'];

type EmployeeAccessInput = {
  username?: string | null;
  role?: string | null;
  pin?: string | null;
  password?: string | null;
  is_active?: boolean | null;
};

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: unknown) {
  const text = normalizeString(value);
  return text || null;
}

function buildEmployeePayload(body: Record<string, unknown>) {
  return {
    full_name: normalizeString(body.full_name),
    employee_number: normalizeNullableString(body.employee_number),
    position: normalizeNullableString(body.position),
    phone: normalizeNullableString(body.phone),
    status: normalizeString(body.status) || 'active',
    payment_type: normalizeString(body.payment_type) || 'piecework',
  };
}

function buildAccessInput(body: Record<string, unknown>): EmployeeAccessInput {
  return {
    username: normalizeNullableString(body.username),
    role: normalizeNullableString(body.role),
    pin: normalizeNullableString(body.pin),
    password: normalizeNullableString(body.password),
    is_active: typeof body.is_active === 'boolean' ? body.is_active : null,
  };
}

function employeeAccessFromRow(user: any) {
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

async function attachAccess(userId: number, access: EmployeeAccessInput) {
  const shveyka = await createServerClient(true);
  const updates: Record<string, unknown> = {};

  if (access.username) updates.username = access.username;
  if (access.role) updates.role = access.role;
  if (access.is_active !== null) updates.is_active = access.is_active;
  if (access.pin) updates.hashed_pin = await hashPassword(access.pin);
  if (access.password) updates.hashed_password = await hashPassword(access.password);

  if (Object.keys(updates).length === 0) return { data: null, error: null };

  return shveyka
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, username, role, is_active, hashed_pin, hashed_password, created_at, updated_at')
    .single();
}

async function createAccess(employeeId: number, access: EmployeeAccessInput, fallbackUsername: string | null, employeeStatus: string) {
  const shveyka = await createServerClient(true);
  if (!access.role || !access.pin || !access.password) {
    return { data: null, error: null };
  }

  const username = access.username || fallbackUsername || `employee-${employeeId}`;
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
      is_active: access.is_active ?? employeeStatus === 'active',
    })
    .select('id, username, role, is_active, hashed_pin, hashed_password, created_at, updated_at')
    .single();
}

export async function GET() {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const shveyka = await createServerClient(true);
  const { data, error } = await shveyka
    .from('employees')
    .select(`
      id,
      full_name,
      employee_number,
      position,
      phone,
      status,
      payment_type,
      created_at,
      updated_at,
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
    .neq('status', 'dismissed')
    .order('full_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const employees = (data || []).map((employee: any) => ({
    ...employee,
    access: employeeAccessFromRow(Array.isArray(employee.users) ? employee.users[0] : employee.users),
    users: undefined,
  }));

  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth || !ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const employeePayload = buildEmployeePayload(body);
  const accessInput = buildAccessInput(body);

  if (!employeePayload.full_name) {
    return NextResponse.json({ error: 'Вкажіть ПІБ' }, { status: 400 });
  }

  const shveyka = await createServerClient(true);

  const { data: employee, error: employeeError } = await shveyka
    .from('employees')
    .insert(employeePayload)
    .select('*')
    .single();

  if (employeeError || !employee) {
    return NextResponse.json({ error: employeeError?.message || 'Не вдалося створити співробітника' }, { status: 500 });
  }

  const { data: access, error: accessError } = await createAccess(
    employee.id,
    accessInput,
    employee.employee_number,
    employee.status
  );

  if (accessError) {
    await shveyka.from('employees').delete().eq('id', employee.id);
    return NextResponse.json({ error: accessError.message }, { status: 500 });
  }

  try {
    const { recordAuditLog } = await import('@/lib/audit');
    await recordAuditLog({
      action: 'CREATE',
      entityType: 'employee',
      entityId: String(employee.id),
      oldData: null,
      newData: {
        ...employee,
        access: employeeAccessFromRow(access),
      },
      request,
      auth: { id: auth.userId, username: auth.username },
    });
  } catch (auditError) {
    console.error('Employees create audit error:', auditError);
  }

  return NextResponse.json({
    ...employee,
    access: employeeAccessFromRow(access),
  });
}
