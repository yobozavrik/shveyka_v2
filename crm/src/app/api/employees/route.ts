import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { EmployeeService } from '@/services/employee.service';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const result = await EmployeeService.getAll(auth);

    if (!result.success) {
      return ApiResponse.error(result.error!, ERROR_CODES.INTERNAL_ERROR, result.status || 500);
    }

    return ApiResponse.success(result.data);
  } catch (error) {
    return ApiResponse.handle(error, 'employees_list');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', 'UNAUTHORIZED', 401);

    const body = await request.json().catch(() => ({}));
    const result = await EmployeeService.create(body, auth, request);

    if (!result.success) {
      return ApiResponse.error(result.error!, ERROR_CODES.INTERNAL_ERROR, result.status || 500);
    }

    return ApiResponse.success(result.data, 201);
  } catch (error) {
    return ApiResponse.handle(error, 'employees_create');
  }
}
