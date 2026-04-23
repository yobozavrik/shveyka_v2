import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { getSupabaseAdmin } from './supabase';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required at runtime');
  return new TextEncoder().encode(secret);
}

export const TOKEN_COOKIE = 'mes_worker_token';
export const ACCESS_TOKEN_COOKIE = 'mes_access_token';
export const REFRESH_TOKEN_COOKIE = 'mes_refresh_token';

export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  employeeId: number | null;
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return signAccessToken(payload);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  return verifyAccessToken(token);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function getTokenFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const accessMatch = cookieHeader.match(new RegExp(`${ACCESS_TOKEN_COOKIE}=([^;]+)`));
    if (accessMatch) return accessMatch[1];
    
    const legacyMatch = cookieHeader.match(new RegExp(`${TOKEN_COOKIE}=([^;]+)`));
    if (legacyMatch) return legacyMatch[1];
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function getRefreshTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const match = cookieHeader.match(new RegExp(`${REFRESH_TOKEN_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export async function getCurrentUser(request: Request): Promise<TokenPayload | null> {
  const token = await getTokenFromRequest(request);
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function saveRefreshToken(
  token: string,
  userId: number,
  employeeId: number | null,
  request: Request
): Promise<void> {
  const tokenHash = hashRefreshToken(token);
  const userAgent = request.headers.get('user-agent') || null;
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwarded?.split(',')[0]?.trim() || realIp || null;

  const supabase = getSupabaseAdmin('shveyka');
  
  const { error } = await supabase
    .from('refresh_tokens')
    .insert({
      token_hash: tokenHash,
      user_id: userId,
      employee_id: employeeId,
      user_agent: userAgent,
      ip_address: ipAddress,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000).toISOString(),
    });

  if (error) {
    console.error('[Auth] Failed to save refresh token:', error);
    throw new Error('Failed to save refresh token');
  }
}

export async function rotateRefreshToken(
  oldToken: string,
  request: Request
): Promise<{ success: boolean; userId?: number; employeeId?: number | null; newToken?: string; error?: string }> {
  const oldTokenHash = hashRefreshToken(oldToken);
  const newToken = generateRefreshToken();
  const newTokenHash = hashRefreshToken(newToken);
  const userAgent = request.headers.get('user-agent') || null;
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwarded?.split(',')[0]?.trim() || realIp || null;

  const supabase = getSupabaseAdmin('shveyka');
  
  const { data, error } = await supabase.rpc('rotate_refresh_token', {
    p_token_hash: oldTokenHash,
    p_new_token_hash: newTokenHash,
    p_user_agent: userAgent,
    p_ip_address: ipAddress,
  });

  if (error) {
    console.error('[Auth] Failed to rotate refresh token:', error);
    return { success: false, error: 'Failed to rotate token' };
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result || !result.success) {
    return { 
      success: false, 
      error: result?.message || 'Invalid refresh token',
    };
  }

  return {
    success: true,
    userId: result.user_id,
    employeeId: result.employee_id,
    newToken,
  };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashRefreshToken(token);
  const supabase = getSupabaseAdmin('shveyka');
  
  await supabase
    .from('refresh_tokens')
    .update({ 
      revoked_at: new Date().toISOString(),
      revoked_reason: 'logout',
    })
    .eq('token_hash', tokenHash);
}

export async function revokeAllUserTokens(userId: number, reason: string = 'security'): Promise<number> {
  const supabase = getSupabaseAdmin('shveyka');
  
  const { data, error } = await supabase.rpc('revoke_all_user_tokens', {
    p_user_id: userId,
    p_reason: reason,
  });

  if (error) {
    console.error('[Auth] Failed to revoke all user tokens:', error);
    return 0;
  }

  return data || 0;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

