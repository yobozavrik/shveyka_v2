import { cookies, headers } from 'next/headers';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
export const AUTH_COOKIE = 'mes_auth_token';
export const REFRESH_COOKIE = 'mes_refresh_token';

export interface AuthPayload {
  userId: number;
  username: string;
  role: string;
  employeeId?: number | null;
}

export async function getAuth(): Promise<AuthPayload | null> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  let token = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(AUTH_COOKIE)?.value;
  }

  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

export async function getRole(): Promise<string | null> {
  const auth = await getAuth();
  return auth?.role || null;
}

export async function requireAuth(allowedRoles?: string[]): Promise<AuthPayload> {
  const auth = await getAuth();
  if (!auth) throw new Error('Unauthorized');
  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    throw new Error('Forbidden');
  }
  return auth;
}
