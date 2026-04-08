import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { batch_id, operation_id, quantity, description, defect_type, severity } = body;

  if (!batch_id) {
    return NextResponse.json({ error: "Обов'язкове поле: batch_id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('defects')
    .insert({
      production_batch_id: batch_id,
      operation_id: operation_id || null,
      employee_id: user.employeeId,
      quantity: quantity || 1,
      description: description || '',
      defect_type: defect_type || 'other',
      severity: severity || 'minor',
      status: 'reported',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

