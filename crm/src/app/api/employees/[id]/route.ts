import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-server';
import { EmployeeService } from '@/services/employee.service';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const result = await EmployeeService.getById(Number(id), auth);

    if (!result.success) {
      return ApiResponse.error(result.error!, ERROR_CODES.INTERNAL_ERROR, result.status || 500);
    }

    return ApiResponse.success(result.data);
  } catch (error) {
    return ApiResponse.handle(error, 'employees_detail');
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    
    const result = await EmployeeService.update(Number(id), body, auth, req);

    if (!result.success) {
      return ApiResponse.error(result.error!, ERROR_CODES.INTERNAL_ERROR, result.status || 500);
    }

    return ApiResponse.success(result.data);
  } catch (error) {
    return ApiResponse.handle(error, 'employees_update');
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const result = await EmployeeService.delete(Number(id), auth, req);

    if (!result.success) {
      return ApiResponse.error(result.error!, ERROR_CODES.INTERNAL_ERROR, result.status || 500);
    }

    return ApiResponse.success(result.data);
  } catch (error) {
    return ApiResponse.handle(error, 'employees_delete');
  }
}
