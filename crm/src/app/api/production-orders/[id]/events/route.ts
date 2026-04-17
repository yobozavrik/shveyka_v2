import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await getAuth();
    if (!auth) return ApiResponse.error('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401);

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (Number.isNaN(orderId)) {
      return ApiResponse.error('Invalid order id', ERROR_CODES.BAD_REQUEST, 400);
    }

    const supabase = await createServerClient(true);

    const { data, error } = await supabase
      .from('production_order_events')
      .select('id, action, from_status, to_status, stage_label, note, payload, created_by, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) return ApiResponse.handle(error, 'production_order_events');

    const events = (data || []).map((event) => ({
      ...event,
      entry_type: 'event',
    }));

    return ApiResponse.success(events);
  } catch (error) {
    return ApiResponse.handle(error, 'production_order_events');
  }
}
