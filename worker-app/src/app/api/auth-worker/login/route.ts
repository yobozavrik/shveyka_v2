import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { signToken, verifyPassword, TOKEN_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      .limit(1);

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
      .select('id, username, hashed_password, hashed_pin, role, employee_id, is_active')
      .eq('employee_id', employee.id)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 });
    }

    const pinValid = await verifyPassword(pin, user.hashed_pin || user.hashed_password);
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
      success: true,
      user: {
        id: employee.id,
        name: employee.full_name,
        number: employee.employee_number,
        role: user.role,
        status: employee.status || 'active',
      },
    });

    response.cookies.set(TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: any) {
    console.error('CRITICAL LOGIN ERROR:', err);
    return NextResponse.json(
      {
        error: 'Помилка сервера при вході',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
