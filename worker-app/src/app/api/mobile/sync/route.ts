import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

interface OfflineEntry {
  local_id: string;
  batch_id: number;
  operation_id: number;
  quantity: number;
  size?: string;
  notes?: string;
  created_at?: string;
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { entries } = await request.json() as { entries: OfflineEntry[] };

  if (!entries?.length) {
    return NextResponse.json({ synced: 0, failed: 0, results: [] });
  }

  const shveykaClient = getSupabaseAdmin('public');
  const results: Array<{ local_id: string; status: 'ok' | 'duplicate' | 'error'; id?: number; error?: string }> = [];
  let synced = 0;
  let failed = 0;

  for (const entry of entries) {
    // Check duplicate
    if (entry.local_id) {
      const { data: existing } = await shveykaClient
        .from('operation_entries')
        .select('id')
        .eq('local_id', entry.local_id)
        .limit(1)
        .single();

      if (existing) {
        results.push({ local_id: entry.local_id, status: 'duplicate', id: existing.id });
        synced++;
        continue;
      }
    }

    const { data, error } = await shveykaClient
      .from('operation_entries')
      .insert({
        production_batch_id: entry.batch_id,
        employee_id: user.employeeId,
        operation_id: entry.operation_id,
        quantity: entry.quantity,
        size: entry.size || null,
        notes: entry.notes || null,
        local_id: entry.local_id || null,
        status: 'submitted',
        entry_source: 'offline',
      })
      .select('id')
      .single();

    if (error) {
      results.push({ local_id: entry.local_id, status: 'error', error: error.message });
      failed++;
    } else {
      results.push({ local_id: entry.local_id, status: 'ok', id: (data as any)?.id });
      synced++;
    }
  }

  return NextResponse.json({ synced, failed, results });
}
