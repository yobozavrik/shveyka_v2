import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { AnalyticsService } from '@/services/analytics.service';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const result = await AnalyticsService.getTopEmployees(days, limit, auth);

    if (!result.success) {
      return ApiResponse.error(result.error!, ERROR_CODES.INTERNAL_ERROR, result.status || 500);
    }

    return ApiResponse.success(result.data);
  } catch (error) {
    return ApiResponse.handle(error, 'analytics_top_employees');
  }
}
