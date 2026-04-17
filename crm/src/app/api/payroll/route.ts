import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { PayrollService } from '@/services/payroll.service';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', 'UNAUTHORIZED', 401);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const result = await PayrollService.getPayrollData(startDate, endDate, auth);

    if (!result.success) {
      return ApiResponse.error(result.error!, ERROR_CODES.INTERNAL_ERROR, result.status || 500);
    }

    return ApiResponse.success(result.data);
  } catch (error) {
    return ApiResponse.handle(error, 'payroll_list');
  }
}
