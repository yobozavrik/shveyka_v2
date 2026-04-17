import { getAuth } from '@/lib/auth-server';
import { AnalyticsService } from '@/services/analytics.service';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES, ErrorCode } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const result = await AnalyticsService.getEmployeeStats(Number(id), auth);

    if (!result.success) {
      // Map common status codes to ERROR_CODES
      let errorCode: ErrorCode = ERROR_CODES.INTERNAL_ERROR;
      if (result.status === 403) errorCode = ERROR_CODES.FORBIDDEN;
      if (result.status === 404) errorCode = ERROR_CODES.NOT_FOUND;
      
      return ApiResponse.error(result.error!, errorCode, result.status || 500);
    }

    return ApiResponse.success(result.data);
  } catch (error) {
    return ApiResponse.handle(error, 'analytics_employee_stats');
  }
}
