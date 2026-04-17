import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { 
  ACCESS_TOKEN_COOKIE, 
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth';
import { checkRateLimit, getRateLimitId, createRateLimitHeaders } from '@/lib/rate-limit';
import { WorkerLoginSchema } from '@shveyka/shared';

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitId = `ip:${clientIp}`;
    const rateLimit = await checkRateLimit('login', rateLimitId);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts' },
        { status: 429, headers: createRateLimitHeaders(rateLimit) }
      );
    }

    const headers = createRateLimitHeaders(rateLimit);

    // 2. Validation
    const body = await request.json().catch(() => ({}));
    const parseResult = WorkerLoginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message ?? 'Validation error' }, 
        { status: 400, headers }
      );
    }

    // 3. Service Call
    const result = await AuthService.login(parseResult.data, request);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error }, 
        { status: result.status, headers }
      );
    }

    // 4. Response & Cookies
    const response = NextResponse.json({
      success: true,
      user: result.user,
      token: result.token
    });

    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set(ACCESS_TOKEN_COOKIE, result.token!, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, result.refreshToken!, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
