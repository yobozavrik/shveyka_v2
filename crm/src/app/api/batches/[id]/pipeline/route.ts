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
    const batchId = parseInt(id);
    const supabase = await createServerClient();

    // Get batch with model
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .select('*, product_models(id, name)')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) return ApiResponse.error('Не знайдено', ERROR_CODES.NOT_FOUND, 404);

    // Get route card for this model
    const { data: routeCard } = await supabase
      .from('route_cards')
      .select('*, route_card_operations(*, operations(id, code, name, base_rate, operation_type))')
      .eq('product_model_id', batch.product_model_id)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    // Get entries for this batch grouped by operation
    const { data: entries } = await supabase
      .from('task_entries')
      .select('operation_id, quantity, data, status')
      .eq('batch_id', batchId);

    // Build pipeline
    let prevConfirmed = 0;

    const operations = routeCard?.route_card_operations
      ?.sort((a: { sequence_number: number }, b: { sequence_number: number }) => a.sequence_number - b.sequence_number)
      .map((rco: any) => {
        const opEntries = (entries || []).filter((e: { operation_id: number }) => e.operation_id === rco.operations.id);

        const sizes: Record<string, { submitted: number, approved: number }> = {};
        opEntries.forEach((e: any) => {
          const size = e.data?.sizes ? Object.keys(e.data.sizes).join(',') : 'default';
          if (!sizes[size]) sizes[size] = { submitted: 0, approved: 0 };
          if (e.status === 'submitted') sizes[size].submitted += e.quantity;
          if (e.status === 'approved') sizes[size].approved += e.quantity;
        });

        const submitted = opEntries.filter((e: { status: string }) => e.status === 'submitted').reduce((s: number, e: { quantity: number }) => s + e.quantity, 0);
        const approved = opEntries.filter((e: { status: string }) => e.status === 'approved').reduce((s: number, e: { quantity: number }) => s + e.quantity, 0);
        const rejected = opEntries.filter((e: { status: string }) => e.status === 'rejected').reduce((s: number, e: { quantity: number }) => s + e.quantity, 0);
        const total = submitted + approved + rejected;

        let status = 'locked';
        if (approved >= batch.quantity) status = 'completed';
        else if (total > 0) status = 'in_progress';
        else if (prevConfirmed > 0) status = 'available';

        prevConfirmed = approved;

        return {
          operation: rco.operations,
          sequence_number: rco.sequence_number,
          rate: rco.custom_rate || rco.operations.base_rate,
          submitted,
          confirmed: approved, // alias for frontend compatibility
          rejected,
          total,
          sizes,
          status,
          progress: batch.quantity > 0 ? Math.round((approved / batch.quantity) * 100) : 0,
        };
      }) || [];

    const cuttingOp = operations.find((o: any) => o.operation.operation_type === 'cutting');
    const cutting_status = cuttingOp ? cuttingOp.status : 'locked';

    // Get defects
    const { data: defects } = await supabase
      .from('defects')
      .select('quantity')
      .eq('production_batch_id', batchId);
    const totalDefects = (defects || []).reduce((s: number, d: { quantity: number }) => s + d.quantity, 0);

    return ApiResponse.success({
      batch,
      operations,
      total_defects: totalDefects,
      route_card: routeCard ? { id: routeCard.id, name: routeCard.name } : null,
      cutting_status,
    });
  } catch (error) {
    return ApiResponse.handle(error, 'batches_pipeline');
  }
}
