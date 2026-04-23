import { NextResponse } from 'next/server';
import { 
  signAccessToken,
  getRefreshTokenFromRequest,
  rotateRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_EXPIRY_SECONDS,
  TokenPayload,
} from '@/lib/auth';
import { checkRateLimit, getRateLimitId, createRateLimitHeaders } from '@/lib/rate-limit';
import { createRequestLogger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const logger = createRequestLogger(request, { action: 'refresh' });

  const rateLimitId = getRateLimitId(request);
  const rateLimit = await checkRateLimit('refresh', rateLimitId);
  
  if (!rateLimit.allowed) {
    logger.warn('Refresh rate limited', { retryAfter: rateLimit.retryAfter });
    return NextResponse.json(
      { error: 'Too many refresh attempts' },
      { 
        status: 429,
        headers: createRateLimitHeaders(rateLimit),
      }
    );
  }

  const refreshToken = getRefreshTokenFromRequest(request);

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const result = await rotateRefreshToken(refreshToken, request);

  if (!result.success) {
    logger.warn('Refresh token invalid', { error: result.error });
    
    const response = NextResponse.json(
      { error: result.error || 'Invalid refresh token' },
      { status: 401 }
    );
    
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    
    return response;
  }

  if (!result.userId || !result.newToken) {
    return NextResponse.json({ error: 'Token rotation failed' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin('shveyka');
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, role, employee_id')
    .eq('id', result.userId)
    .single();

  if (error || !user) {
    logger.error('User not found for refresh token', error);
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    employeeId: user.employee_id,
  } as TokenPayload);

  const response = NextResponse.json({ success: true });

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, result.newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
    path: '/',
  });

  logger.info('Token refreshed successfully', { userId: user.id });

  return response;
}
