import { getAuth } from '@/lib/auth-server';
import { EntryService } from '@/services/entry.service';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const result = await EntryService.getById(Number(id), auth);

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
    return ApiResponse.handle(error, 'entries_id_get');
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    const result = await EntryService.update(Number(id), body, auth);

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
    return ApiResponse.handle(error, 'entries_id_patch');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const result = await EntryService.delete(Number(id), auth);

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

    return ApiResponse.success({ success: true });
  } catch (error) {
    return ApiResponse.handle(error, 'entries_id_delete');
  }
}
