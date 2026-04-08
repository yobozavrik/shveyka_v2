import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { signToken, verifyPassword, TOKEN_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface EmployeeRow {
  id: number;
  full_name: string;
  employee_number: string | null;
  status: string | null;
}

interface UserRow {
  id: number;
  username: string;
  hashed_password: string;
  hashed_pin: string | null;
  role: string;
  employee_id: number | null;
  is_active: boolean;
  employees: EmployeeRow | null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const employeeNumber = typeof body.employee_number === 'string' ? body.employee_number.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!employeeNumber || !pin || !password) {
      return NextResponse.json({ error: 'Введіть табельний №, PIN та пароль' }, { status: 400 });
    }

    const shveyka = getSupabaseAdmin('shveyka');

    const { data: employees, error: empError } = await shveyka
      .from('employees')
      .select('id, full_name, employee_number, status')
      .eq('employee_number', employeeNumber)
      .or('status.eq.active,status.is.null')
      .order('id', { ascending: true });

    const employee = employees && employees.length > 0 ? employees[0] : null;
    if (empError || !employee) {
      return NextResponse.json({ error: 'Працівника не знайдено' }, { status: 404 });
    }

    const employeeStatus = (employee.status || 'active').toLowerCase();
    if (employeeStatus !== 'active') {
      return NextResponse.json({ error: 'Доступ для співробітника вимкнено' }, { status: 403 });
    }

    const { data: user, error: userError } = await shveyka
      .from('users')
      .select('id, username, hashed_password, hashed_pin, role, employee_id, is_active, employees(id, full_name, employee_number, status)')
      .eq('employee_id', employee.id)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 });
    }

    const pinHash = user.hashed_pin || user.hashed_password;
    const pinValid = pinHash ? await verifyPassword(pin, pinHash) : false;
    const passwordValid = await verifyPassword(password, user.hashed_password);

    if (!pinValid || !passwordValid) {
      return NextResponse.json({ error: 'Невірний PIN або пароль' }, { status: 401 });
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employee_id,
    });

    const response = NextResponse.json({
      token,
      role: user.role,
      employee: {
        id: employee.id,
        full_name: employee.full_name,
        employee_number: employee.employee_number,
        status: employee.status || 'active',
      },
    });

    response.cookies.set(TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
