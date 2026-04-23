import { createServerClient } from '@/lib/supabase/server';
import { getRole } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const role = await getRole();
    if (!['admin', 'manager'].includes(role || '')) {
      return ApiResponse.error('Без доступу', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { error } = await supabase.rpc('confirm_warehouse_document', {
      p_doc_id: parseInt(id),
    });

    if (error) return ApiResponse.handle(error, 'warehouse_documents_confirm');

    return ApiResponse.success({ success: true });
  } catch (error) {
    return ApiResponse.handle(error, 'warehouse_documents_confirm');
  }
}
