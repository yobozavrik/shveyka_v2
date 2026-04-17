import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('supply_documents')
      .select('*, suppliers(id, name), supply_items(*, items(id, name, sku, unit))')
      .eq('id', parseInt(id))
      .single();

    if (error) return ApiResponse.handle(error, 'warehouse_supply_docs');
    if (!data) return ApiResponse.error('Не знайдено', ERROR_CODES.NOT_FOUND, 404);
    
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.handle(error, 'warehouse_supply_docs');
  }
}
