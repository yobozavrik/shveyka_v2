import { ApiResponse } from '@/lib/api-response';
import { AuthService } from '@/services/auth.service';
import { AUTH_COOKIE, REFRESH_COOKIE } from '@/lib/auth-server';
import { REFRESH_TOKEN_EXPIRY_SECONDS } from '@/lib/auth';
import { checkRateLimit, getRateLimitId, createRateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit';
import { ERROR_CODES, LoginSchema } from '@shveyka/shared';

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitId = getRateLimitId(`ip:${clientIp}`);
    const rateLimit = await checkRateLimit(rateLimitId, 'login');
    
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt.getTime());
    }

    const headers = createRateLimitHeaders(rateLimit.remaining, rateLimit.resetAt.getTime());

    // 2. Validation
    const body = await request.json().catch(() => ({}));
    const parseResult = LoginSchema.safeParse(body);

    if (!parseResult.success) {
      const response = ApiResponse.error('Невірні дані входу', ERROR_CODES.VALIDATION_ERROR, 400);
      headers.forEach((value, key) => response.headers.set(key, value));
      return response;
    }

    // 3. Service Call
    const result = await AuthService.login(parseResult.data, request);

    if (!result.success) {
      return ApiResponse.error(result.error!, ERROR_CODES.UNAUTHORIZED, result.status || 401);
    }

    // 4. Response & Cookies
    const response = ApiResponse.success({
      token: result.token,
      user: result.user
    });

    response.cookies.set(AUTH_COOKIE, result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15,
      path: '/',
    });

    response.cookies.set(REFRESH_COOKIE, result.refreshToken!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    return ApiResponse.handle(error, 'auth_login');
  }
}
