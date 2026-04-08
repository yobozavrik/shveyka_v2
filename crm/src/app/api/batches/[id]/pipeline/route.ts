import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const batchId = parseInt(id);
  const supabase = await createServerClient();

  // Get batch with model
  const { data: batch } = await supabase
    .from('production_batches')
    .select('*, product_models(id, name)')
    .eq('id', batchId)
    .single();

  if (!batch) return NextResponse.json({ error: 'Не знайдено' }, { status: 404 });

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
    .from('operation_entries')
    .select('operation_id, quantity, size, status')
    .eq('production_batch_id', batchId);

  // Build pipeline
  let prevConfirmed = batch.quantity;

  const operations = routeCard?.route_card_operations
    ?.sort((a: { sequence_number: number }, b: { sequence_number: number }) => a.sequence_number - b.sequence_number)
    .map((rco: any) => {
      const opEntries = (entries || []).filter((e: { operation_id: number }) => e.operation_id === rco.operations.id);
      
      const sizes: Record<string, { submitted: number, confirmed: number }> = {};
      opEntries.forEach((e: any) => {
        const size = e.size || 'default';
        if (!sizes[size]) sizes[size] = { submitted: 0, confirmed: 0 };
        if (e.status === 'submitted') sizes[size].submitted += e.quantity;
        if (e.status === 'confirmed') sizes[size].confirmed += e.quantity;
      });

      const submitted = opEntries.filter((e: { status: string }) => e.status === 'submitted').reduce((s: number, e: { quantity: number }) => s + e.quantity, 0);
      const confirmed = opEntries.filter((e: { status: string }) => e.status === 'confirmed').reduce((s: number, e: { quantity: number }) => s + e.quantity, 0);
      const rejected = opEntries.filter((e: { status: string }) => e.status === 'rejected').reduce((s: number, e: { quantity: number }) => s + e.quantity, 0);
      const total = submitted + confirmed + rejected;

      let status = 'locked';
      if (confirmed >= batch.quantity) status = 'completed';
      else if (total > 0) status = 'in_progress';
      else if (prevConfirmed > 0) status = 'available';

      prevConfirmed = confirmed;

      return {
        operation: rco.operations,
        sequence_number: rco.sequence_number,
        rate: rco.custom_rate || rco.operations.base_rate,
        submitted,
        confirmed,
        rejected,
        total,
        sizes,
        status,
        progress: batch.quantity > 0 ? Math.round((confirmed / batch.quantity) * 100) : 0,
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

  return NextResponse.json({
    batch,
    operations,
    total_defects: totalDefects,
    route_card: routeCard ? { id: routeCard.id, name: routeCard.name } : null,
    cutting_status,
  });
}
