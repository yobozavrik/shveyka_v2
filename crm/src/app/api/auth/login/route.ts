import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { verifyPassword, signToken } from '@/lib/auth';
import { AUTH_COOKIE } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const cleanUsername = username?.trim();
    const cleanPassword = password?.trim();

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json({ message: 'Введіть логін та пароль' }, { status: 400 });
    }

    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('*, employees(*)')
      .eq('username', cleanUsername)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return NextResponse.json({ message: 'Невірний логін або пароль' }, { status: 401 });
    }

    const isPasswordValid = await verifyPassword(cleanPassword, user.hashed_password);

    if (!isPasswordValid) {
      return NextResponse.json({ message: 'Невірний логін або пароль' }, { status: 401 });
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employee_id ?? null,
    });

    const response = NextResponse.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, employee: user.employees }
    });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Помилка сервера' }, { status: 500 });
  }
}
