import { createServerClient } from '@/lib/supabase/server';
import { verifyPassword, signToken, generateRefreshToken, saveRefreshToken } from '@/lib/auth';
import { LoginInput } from '@shveyka/shared';

export class AuthService {
  static async login(input: LoginInput, request: Request) {
    const supabase = await createServerClient(true);

    const { data: user, error } = await supabase
      .from('users')
      .select('*, employees(*)')
      .eq('username', input.username)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return { success: false, error: 'Invalid username or password', status: 401 };
    }

    const isPasswordValid = await verifyPassword(input.password, user.hashed_password);

    if (!isPasswordValid) {
      return { success: false, error: 'Invalid username or password', status: 401 };
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employee_id ?? null,
    });

    const refreshToken = generateRefreshToken();
    await saveRefreshToken(refreshToken, user.id, user.employee_id ?? null, request);

    return {
      success: true,
      token,
      refreshToken,
      user: { id: user.id, username: user.username, role: user.role, employee: user.employees }
    };
  }
}
