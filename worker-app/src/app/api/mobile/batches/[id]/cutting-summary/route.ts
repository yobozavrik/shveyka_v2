import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  { params }: Params
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const batchId = parseInt(id);

  // Get batch info
  const shveykaClient = getSupabaseAdmin('shveyka');

  const { data: batch } = await shveykaClient
    .from('production_batches')
    .select('id, batch_number, quantity, product_models(id, name)')
    .eq('id', batchId)
    .single();

  if (!batch) return NextResponse.json({ error: 'Партію не знайдено' }, { status: 404 });

  // Get nastils
  const { data: nastils } = await shveykaClient
    .from('cutting_nastils')
    .select('id, nastil_name, age_group, sizes_json, total_qty, created_at, employees(id, full_name)')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });

  // Summarize sizes from all nastils
  const sizesSummary: Record<string, number> = {};
  let totalCut = 0;
  for (const nastil of nastils || []) {
    const sizes = nastil.sizes_json as Array<{ size: string; quantity: number }> || [];
    for (const s of sizes) {
      sizesSummary[s.size] = (sizesSummary[s.size] || 0) + s.quantity;
      totalCut += s.quantity;
    }
  }

  return NextResponse.json({
    batch,
    nastils: nastils || [],
    summary: {
      total_nastils: (nastils || []).length,
      total_cut: totalCut,
      planned: batch.quantity,
      remaining: batch.quantity - totalCut,
      sizes: sizesSummary,
    },
  });
}
