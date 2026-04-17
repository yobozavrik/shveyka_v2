import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { createServerClient } from './supabase/server';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
export const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  employeeId?: number | null;
}

export async function signToken(payload: TokenPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as TokenPayload;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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

  const supabase = await createServerClient(true);
  
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

  const supabase = await createServerClient(true);
  
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
  const supabase = await createServerClient(true);
  
  await supabase
    .from('refresh_tokens')
    .update({ 
      revoked_at: new Date().toISOString(),
      revoked_reason: 'logout',
    })
    .eq('token_hash', tokenHash);
}

export async function revokeAllUserTokens(userId: number, reason: string = 'security'): Promise<number> {
  const supabase = await createServerClient(true);
  
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