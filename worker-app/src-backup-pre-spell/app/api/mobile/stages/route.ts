import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

type StageRow = {
  id: number;
  code: string;
  name: string;
  assigned_role: string;
  sequence_order: number;
  color: string | null;
  is_active: boolean;
};

type OperationRow = {
  id: number;
  stage_id: number;
  code: string;
  name: string;
  field_schema: unknown;
  sort_order: number;
  is_active: boolean;
};

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin('shveyka');
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get('include_inactive') === 'true';
  const code = url.searchParams.get('code')?.trim() || '';

  let stagesQuery = supabase
    .from('production_stages')
    .select('id, code, name, assigned_role, sequence_order, color, is_active')
    .order('sequence_order', { ascending: true })
    .order('code', { ascending: true });

  if (!includeInactive) {
    stagesQuery = stagesQuery.eq('is_active', true);
  }

  if (code) {
    stagesQuery = stagesQuery.eq('code', code);
  }

  const [{ data: stages, error: stagesError }, { data: operations, error: operationsError }] =
    await Promise.all([
      stagesQuery,
      supabase
        .from('stage_operations')
        .select('id, stage_id, code, name, field_schema, sort_order, is_active')
        .order('stage_id', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('code', { ascending: true }),
    ]);

  if (stagesError) {
    return NextResponse.json({ error: stagesError.message }, { status: 500 });
  }

  if (operationsError) {
    return NextResponse.json({ error: operationsError.message }, { status: 500 });
  }

  const operationsByStage = new Map<number, OperationRow[]>();
  for (const operation of (operations || []) as OperationRow[]) {
    if (!operation.is_active && !includeInactive) continue;
    if (!operationsByStage.has(operation.stage_id)) {
      operationsByStage.set(operation.stage_id, []);
    }
    operationsByStage.get(operation.stage_id)!.push(operation);
  }

  const payload = ((stages || []) as StageRow[]).map((stage) => ({
    ...stage,
    operations: operationsByStage.get(stage.id) || [],
  }));

  return NextResponse.json(payload);
}
