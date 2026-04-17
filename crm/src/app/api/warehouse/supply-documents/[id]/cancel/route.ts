import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth || !['admin', 'manager'].includes(auth.role)) {
      return ApiResponse.error('Доступ заборонено', ERROR_CODES.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data: doc } = await supabase
      .from('supply_documents')
      .select('status')
      .eq('id', parseInt(id))
      .single();

    if (!doc) return ApiResponse.error('Не знайдено', ERROR_CODES.NOT_FOUND, 404);
    if (doc.status !== 'draft') return ApiResponse.error('Скасувати можна тільки draft', ERROR_CODES.BAD_REQUEST, 400);

    const { data, error } = await supabase
      .from('supply_documents')
      .update({ status: 'cancelled' })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) return ApiResponse.handle(error, 'warehouse_supply_docs_cancel');
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'warehouse_supply_docs_cancel');
  }
}
