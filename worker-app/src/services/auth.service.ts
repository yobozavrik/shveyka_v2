import { getSupabaseAdmin } from '@/lib/supabase';
import {
  signAccessToken,
  generateRefreshToken,
  saveRefreshToken,
} from '@/lib/auth';
import { WorkerLoginInput } from '@shveyka/shared';

export class AuthService {
  static async login(input: WorkerLoginInput, request: Request) {
    const supabase = getSupabaseAdmin('shveyka');

    const { data: employee, error } = await supabase
      .from('employees')
      .select('id, full_name, pin_code, status')
      .eq('pin_code', input.pin)
      .eq('status', 'active')
      .single();

    if (error || !employee) {
      if (error) {
        console.error('[AuthService.login] Employee lookup failed:', error);
      }
      return { success: false, error: 'Невірний PIN-код', status: 401 };
    }

    const token = await signAccessToken({
      userId: employee.id, // In worker app, userId is often employeeId
      username: employee.full_name,
      role: 'worker',
      employeeId: employee.id,
    });

    const refreshToken = generateRefreshToken();
    await saveRefreshToken(refreshToken, employee.id, employee.id, request);

    return {
      success: true,
      token,
      refreshToken,
      user: {
        id: employee.id,
        name: employee.full_name,
        role: 'worker',
      },
    };
  }
}
