import { NextResponse } from 'next/server';
import { createServerClient } from './supabase/server';

interface RateLimitConfig {
  max: number;
  windowSec: number;
  type: 'ip' | 'user';
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { max: 5, windowSec: 60, type: 'ip' },
  refresh: { max: 10, windowSec: 60, type: 'ip' },
  general: { max: 200, windowSec: 60, type: 'ip' },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter: number;
}

export function getRateLimitId(identifier: string): string {
  return identifier;
}

export async function checkRateLimit(
  identifier: string,
  action: keyof typeof RATE_LIMITS = 'general'
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  if (!config) {
    throw new Error(`Unknown rate limit action: ${action}`);
  }

  try {
    const supabase = await createServerClient(true);
    
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
  } catch (error) {
    console.error('[RateLimit] Error checking limit:', error);
    return {
      allowed: true,
      limit: config.max,
      remaining: config.max,
      resetAt: new Date(Date.now() + config.windowSec * 1000),
      retryAfter: 0,
    };
  }
}

export function createRateLimitHeaders(remaining: number, resetTime: number): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Remaining', String(remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
  return headers;
}

export function rateLimitResponse(resetTime: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { 
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000))
      }
    }
  );
}
