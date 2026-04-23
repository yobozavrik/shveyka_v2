import { AUTH_COOKIE, REFRESH_COOKIE } from '@/lib/auth-server';
import { revokeRefreshToken } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    let refreshToken = null;
    
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`));
      if (match) {
        refreshToken = match[1];
      }
    }

    if (refreshToken) {
      try {
        await revokeRefreshToken(refreshToken);
      } catch (error) {
        console.error('[Logout] Failed to revoke refresh token:', error);
      }
    }
  } catch (error) {
    console.error('[Logout] Error processing request:', error);
  }

  const res = ApiResponse.success({ success: true });
  res.cookies.delete(AUTH_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
