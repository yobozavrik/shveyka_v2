import { NextResponse } from 'next/server';
import { ApiError, ERROR_CODES, ErrorCode } from '@shveyka/shared';
import { appLogger } from './logger';

export class ApiResponse {
  static success(data: any = { success: true }, status: number = 200) {
    return NextResponse.json(data, { status });
  }

  static error(message: string, code: ErrorCode = ERROR_CODES.INTERNAL_ERROR, status: number = 500, details?: any) {
    const errorResponse: ApiError = { 
      error: message, 
      code,
      ...(process.env.NODE_ENV === 'development' && details ? { details } : {})
    };
    return NextResponse.json(errorResponse, { status });
  }

  /**
   * Обробка виключень у роутах
   */
  static handle(error: any, module: string = 'api_route') {
    console.error(`[${module}] Exception:`, error);

    // Логуємо в БД/систему
    try {
      appLogger({
        level: 'error',
        message: error instanceof Error ? error.message : String(error),
        module,
        action: 'handle_exception',
        error: error instanceof Error ? error.stack : undefined
      });
    } catch (e) { /* ignore logging errors */ }

    // Спеціальна обробка типів помилок
    if (error.message === 'Unauthorized') {
      return this.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);
    }
    if (error.message === 'Forbidden') {
      return this.error('Forbidden', ERROR_CODES.FORBIDDEN, 403);
    }
    if (error.code === 'PGRST116') { // Supabase single() not found
      return this.error('Resource not found', ERROR_CODES.NOT_FOUND, 404);
    }

    return this.error(
      process.env.NODE_ENV === 'development' ? (error.message || String(error)) : 'Внутрішня помилка сервера',
      ERROR_CODES.INTERNAL_ERROR,
      500
    );
  }
}
