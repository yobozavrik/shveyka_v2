import { NextResponse } from 'next/server';
import { 
  ACCESS_TOKEN_COOKIE, 
  REFRESH_TOKEN_COOKIE,
  TOKEN_COOKIE,
  getRefreshTokenFromRequest,
  revokeRefreshToken,
} from '@/lib/auth';

export async function POST(request: Request) {
  const refreshToken = getRefreshTokenFromRequest(request);
  
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch (error) {
      console.error('[Logout] Failed to revoke refresh token:', error);
    }
  }

  const response = NextResponse.json({ success: true });
  
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  response.cookies.delete(TOKEN_COOKIE);
  
  return response;
}

