import { getSupabaseAdmin } from './supabase';

interface RateLimitConfig {
  max: number;
  windowSec: number;
  type: 'ip' | 'user';
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { max: 5, windowSec: 60, type: 'ip' },
  refresh: { max: 10, windowSec: 60, type: 'ip' },
  entries: { max: 100, windowSec: 60, type: 'user' },
  general: { max: 200, windowSec: 60, type: 'ip' },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter: number;
}

export function getRateLimitId(request: Request, employeeId?: number | null): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  
  return employeeId ? `user:${employeeId}` : `ip:${ip}`;
}

export async function checkRateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  if (!config) {
    throw new Error(`Unknown rate limit action: ${action}`);
  }

  const supabase = getSupabaseAdmin('shveyka');
  
  const { data, error } = await supabase.rpc('check_rate_limit_with_cleanup', {
    p_key: identifier,
    p_action: action,
    p_max_requests: config.max,
    p_window_seconds: config.windowSec,
  });

  if (error) {
    console.error('[RateLimit] RPC error:', error);
    return {
      allowed: true,
      limit: config.max,
      remaining: config.max,
      resetAt: new Date(Date.now() + config.windowSec * 1000),
      retryAfter: 0,
    };
  }

  const result = Array.isArray(data) ? data[0] : data;

  return {
    allowed: result.allowed,
    limit: result.limit_max,
    remaining: result.remaining,
    resetAt: new Date(result.reset_at),
    retryAfter: result.retry_after,
  };
}

export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
  };

  if (!result.allowed) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}
