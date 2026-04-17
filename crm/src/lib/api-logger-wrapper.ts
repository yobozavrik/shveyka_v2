import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-server';
import { appLogger } from './logger';

/**
 * Оборачивает API Route, чтобы автоматически логировать запросы.
 * Особенно полезно для POST/PUT/DELETE.
 */
export async function withApiLogger(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  actionName: string
): Promise<NextResponse> {
  const startTime = Date.now();
  
  // 1. Пытаемся узнать пользователя
  let authInfo = null;
  try {
    authInfo = await getAuth();
  } catch (e) { /* не авторизован */ }

  const username = authInfo?.username || 'guest';
  const userId = authInfo?.userId?.toString();

  try {
    // 2. Читаем тело запроса (клон, чтобы не сломать handler)
    let bodySnapshot = null;
    if (request.headers.get('content-type')?.includes('application/json')) {
       try {
         bodySnapshot = await request.clone().json();
         // Убираем чувствительные данные из лога
         if (bodySnapshot.password) bodySnapshot.password = '***';
       } catch { /* не JSON */ }
    }

    // 3. Выполняем сам запрос
    const response = await handler();

    // 4. Логируем успех
    await appLogger({
      level: 'user_action',
      message: `${username} -> ${actionName} (${request.method} ${request.nextUrl.pathname})`,
      module: 'api_auto_logger',
      action: actionName,
      userId,
      username,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || '',
      data: {
        method: request.method,
        url: request.nextUrl.pathname,
        status: response.status,
        duration_ms: Date.now() - startTime,
        request_body: bodySnapshot // Лог того, ЧТО пользователь ввел/нажал
      }
    });

    return response;

  } catch (error) {
    // 5. Логируем ошибку
    await appLogger({
      level: 'error',
      message: `Error in ${actionName}: ${error instanceof Error ? error.message : String(error)}`,
      module: 'api_auto_logger',
      action: actionName,
      userId,
      username,
      error: error instanceof Error ? error.stack : String(error),
      data: {
        method: request.method,
        url: request.nextUrl.pathname,
        duration_ms: Date.now() - startTime
      }
    });
    
    // Пробрасываем ошибку дальше (или возвращаем 500)
    throw error;
  }
}