import { createServerClient } from '@/lib/supabase/server';
import { 
  signToken, 
  rotateRefreshToken, 
  REFRESH_TOKEN_EXPIRY_SECONDS 
} from '@/lib/auth';
import { AUTH_COOKIE, REFRESH_COOKIE } from '@/lib/auth-server';
import { checkRateLimit, getRateLimitId, createRateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitId = getRateLimitId(`ip:${clientIp}`);
    const rateLimit = await checkRateLimit(rateLimitId, 'refresh');
    
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt.getTime());
    }

    const headers = createRateLimitHeaders(rateLimit.remaining, rateLimit.resetAt.getTime());

    const cookieHeader = request.headers.get('cookie');
    let currentRefreshToken = null;
    
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`));
      if (match) {
        currentRefreshToken = match[1];
      }
    }

    if (!currentRefreshToken) {
      return ApiResponse.error('No refresh token provided', ERROR_CODES.UNAUTHORIZED, 401, { headers });
    }

    const rotationResult = await rotateRefreshToken(currentRefreshToken, request);

    if (!rotationResult.success || !rotationResult.userId || !rotationResult.newToken) {
      const response = ApiResponse.error(rotationResult.error || 'Invalid or expired refresh token', ERROR_CODES.UNAUTHORIZED, 401, { headers });
      
      // Clear cookies if token is invalid
      response.cookies.delete(AUTH_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }

    const supabase = await createServerClient(true);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, employee_id, is_active')
      .eq('id', rotationResult.userId)
      .single();

    if (error || !user || !user.is_active) {
      const response = ApiResponse.error('User not found or inactive', ERROR_CODES.UNAUTHORIZED, 401);
      response.cookies.delete(AUTH_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employee_id ?? null,
    });

    const response = ApiResponse.success({ success: true });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15,
      path: '/',
    });

    response.cookies.set(REFRESH_COOKIE, rotationResult.newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    return ApiResponse.handle(error, 'auth_refresh');
  }
}
