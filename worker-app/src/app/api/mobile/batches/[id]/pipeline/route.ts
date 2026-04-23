import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { extractSelectedSizes, extractSizeVariantQuantities } from '@/lib/sizeVariants';
import { sortSizeLabels } from '@/lib/overlock';

export interface SizeQty {
  size: string;
  confirmed_qty: number;
  submitted_qty: number;
  defect_qty: number;
  metric_qty: number;
}

export interface PipelineOperation {
  id: number;
  rco_id: number; // For backward compatibility with UI, set to 0 or same as ID
  sequence_number: number;
  name: string;
  code: string;
  operation_type: string;
  base_rate: number;
  custom_rate: number | null;
  is_control_point: boolean;
  is_mandatory: boolean;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  total_confirmed: number;
  total_submitted: number;
  sizes: SizeQty[];
}

function sortSizes(sizes: SizeQty[]): SizeQty[] {
  const order = new Map(sortSizeLabels(sizes.map((item) => item.size)).map((size, index) => [size, index]));
  return [...sizes].sort((left, right) => (order.get(left.size) ?? 0) - (order.get(right.size) ?? 0));
}

type SizeMap = Record<string, number>;

interface EntryRow {
  operation_id: number;
  status: string;
  size: string | null;
  quantity: number;
  defect_quantity: number;
  metric_value: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const batchId = parseInt(id);
  const shveykaClient = getSupabaseAdmin('shveyka');

  // 1. Get batch info (we still need quantity and size variants)
  const { data: batch, error: batchErr } = await shveykaClient
    .from('production_batches')
    .select('id, quantity, size_variants, status')
    .eq('id', batchId)
    .single();

  if (batchErr || !batch) {
    return NextResponse.json({ error: 'Партія не знайдена' }, { status: 404 });
  }

  // 2. Get ALL standard operations instead of route card operations
  // Filter for top-level operations (parent_id IS NULL) and sort by sort_order
  const { data: opsList, error: opsErr } = await shveykaClient
    .from('operations')
    .select('id, name, code, operation_type, base_rate, is_active, sort_order')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (opsErr || !opsList?.length) {
    return NextResponse.json({ pipeline: [], batch_id: batchId, total_qty: batch.quantity, error: 'Довідник операцій порожній' });
  }

  // 3. Get entries for this batch
  const { data: entries } = await shveykaClient
    .from('operation_entries')
    .select('operation_id, status, size, quantity, defect_quantity, metric_value')
    .eq('production_batch_id', batchId);

  const entryMap: Record<number, { 
    confirmed: SizeMap; 
    submitted: SizeMap;
    submitted_details?: Record<string, { qty: number, def: number, met: number }>;
  }> = {};

  for (const entry of (entries ?? []) as EntryRow[]) {
    const opId = entry.operation_id;
    if (!entryMap[opId]) entryMap[opId] = { confirmed: {}, submitted: {} };

    const size = entry.size || 'ALL';
    const qty = Number(entry.quantity || 0);
    const def = Number(entry.defect_quantity || 0);
    const met = Number(entry.metric_value || 0);

    if (entry.status === 'approved') {
      entryMap[opId].confirmed[size] = (entryMap[opId].confirmed[size] || 0) + qty;
    } else if (entry.status === 'submitted') {
      if (!entryMap[opId].submitted_details) entryMap[opId].submitted_details = {};
      const current = entryMap[opId].submitted_details[size] || { qty: 0, def: 0, met: 0 };
      entryMap[opId].submitted_details[size] = {
        qty: current.qty + qty,
        def: current.def + def,
        met: current.met + met,
      };
      entryMap[opId].submitted[size] = (entryMap[opId].submitted[size] || 0) + qty;
    }
  }

  const totalQty = batch.quantity;

  // 4. Build pipeline based on the operations list order
  const pipeline: PipelineOperation[] = opsList.map((op: any, index: number) => {
    const opId = op.id;
    const opData = entryMap[opId] || { confirmed: {}, submitted: {} };

    const totalConfirmed = Object.values(opData.confirmed).reduce((s: number, v: number) => s + v, 0);
    const totalSubmitted = Object.values(opData.submitted).reduce((s: number, v: number) => s + v, 0);

    const sizeSet = new Set([
      ...Object.keys(opData.confirmed),
      ...Object.keys(opData.submitted),
    ]);

    // Available sizes logic
    if (index > 0) {
      const prevOp = opsList[index - 1];
      const prevConfirmedSizes = entryMap[prevOp.id]?.confirmed || {};
      for (const sz of Object.keys(prevConfirmedSizes)) sizeSet.add(sz);
    } else if (batch.size_variants) {
      for (const sz of extractSelectedSizes(batch.size_variants)) sizeSet.add(sz);
      for (const sz of Object.keys(extractSizeVariantQuantities(batch.size_variants))) sizeSet.add(sz);
    }

    const sizes: SizeQty[] = sortSizes(
      Array.from(sizeSet).map((size) => ({
        size,
        confirmed_qty: opData.confirmed[size] || 0,
        submitted_qty: opData.submitted[size] || 0,
        defect_qty: opData.submitted_details?.[size]?.def || 0,
        metric_qty: opData.submitted_details?.[size]?.met || 0,
      }))
    );

    let status: PipelineOperation['status'];
    if (index === 0) {
      // First operation always available
      if (totalConfirmed >= totalQty) status = 'completed';
      else if (totalSubmitted > 0 || totalConfirmed > 0) status = 'in_progress';
      else status = 'available';
    } else {
      // Subsequent operations depend on PREVIOUS operation total completion
      const prevOp = opsList[index - 1];
      const prevOpData = entryMap[prevOp.id] || { confirmed: {}, submitted: {} };
      const prevConfirmedTotal = Object.values(prevOpData.confirmed).reduce((s, v) => s + v, 0);

      const isPrevCompleted = prevConfirmedTotal >= totalQty;

      if (!isPrevCompleted) {
        status = 'locked';
      } else if (totalConfirmed >= totalQty) {
        status = 'completed';
      } else if (totalSubmitted > 0 || totalConfirmed > 0) {
        status = 'in_progress';
      } else {
        status = 'available';
      }
    }

    return {
      id: opId,
      rco_id: opId, // Setting to opId as we don't use RouteCardOperations anymore
      sequence_number: index + 1,
      name: op.name,
      code: op.code || '',
      operation_type: op.operation_type || 'sewing',
      base_rate: op.base_rate || 0,
      custom_rate: null,
      is_control_point: false, // Defaulting as we don't have this in operations table yet
      is_mandatory: true,
      status,
      total_confirmed: totalConfirmed,
      total_submitted: totalSubmitted,
      sizes,
    };
  });

  let filteredPipeline = pipeline;

  // 5. Role-based filtering
  const { data: emp } = user.employeeId ? await shveykaClient
    .from('employees')
    .select('position')
    .eq('id', user.employeeId)
    .limit(1)
    .single() : { data: null };

  const dbPosition = (emp?.position || '').toLowerCase();
  const jwtRole = (user.role || '').toLowerCase();

  const isManager = ['admin', 'master', 'supervisor', 'manager'].includes(jwtRole) || 
                    ['admin', 'master', 'supervisor', 'manager'].includes(dbPosition);
  
  if (!isManager && user.employeeId) {
    const accessMatrix: Record<string, string[]> = {
      'розкрійник': ['розкрій', 'cut'],
      'вишивальник': ['вишивка', 'embroidery', 'emb'],
      'швачка': ['оверлок', 'прямострочка', 'розпошив', 'пошив', 'sew', 'обробка', 'stitch', 'over', 'cover'],
      'упаковщик': ['упаковка', 'pack'],
      'контролер': ['контроль', 'quality']
    };

    const allowedKeywords = accessMatrix[dbPosition] || [];

    if (allowedKeywords.length > 0) {
      filteredPipeline = pipeline.filter(op => {
        const opName = op.name.toLowerCase();
        const opCode = op.code.toLowerCase();
        return allowedKeywords.some(key => opName.includes(key) || opCode.includes(key));
      });
    } else {
      filteredPipeline = [];
    }
  }

  return NextResponse.json({ batch_id: batchId, total_qty: totalQty, pipeline: filteredPipeline, free_mode: true });
}
