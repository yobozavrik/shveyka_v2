import { getAuth } from '@/lib/auth-server';
import { PayrollService } from '@/services/payroll.service';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { searchParams } = new URL(request.url);
    const employee_id = searchParams.get('employee_id');
    const period_id = searchParams.get('period_id');
    
    const result = await PayrollService.getAdjustments({ employee_id, period_id }, auth);

    if (!result.success) {
      const status = result.status || 500;
      const code =
        status === 401 ? ERROR_CODES.UNAUTHORIZED :
        status === 403 ? ERROR_CODES.FORBIDDEN :
        status === 404 ? ERROR_CODES.NOT_FOUND :
        status === 400 ? ERROR_CODES.BAD_REQUEST :
        ERROR_CODES.INTERNAL_ERROR;
      return ApiResponse.error(result.error!, code, status);
    }

    return ApiResponse.success(result.data);
  } catch (error) {
    return ApiResponse.handle(error, 'payroll_adjustments_get');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);
    
    const body = await request.json().catch(() => ({}));
    const result = await PayrollService.createAdjustment(body, auth);

    if (!result.success) {
      const status = result.status || 500;
      const code =
        status === 401 ? ERROR_CODES.UNAUTHORIZED :
        status === 403 ? ERROR_CODES.FORBIDDEN :
        status === 404 ? ERROR_CODES.NOT_FOUND :
        status === 400 ? ERROR_CODES.BAD_REQUEST :
        ERROR_CODES.INTERNAL_ERROR;
      return ApiResponse.error(result.error!, code, status);
    }

    return ApiResponse.success(result.data, 201);
  } catch (error) {
    return ApiResponse.handle(error, 'payroll_adjustments_post');
  }
}
