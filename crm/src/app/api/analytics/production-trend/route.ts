import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const supabase = await createServerClient(true);

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const [entriesRes, defectsRes] = await Promise.all([
      supabase
        .from('operation_entries')
        .select('entry_date, quantity, status')
        .gte('entry_date', dateFrom.toISOString().split('T')[0])
        .eq('status', 'confirmed'),
      supabase
        .from('defects')
        .select('created_at, quantity')
        .gte('created_at', dateFrom.toISOString())
    ]);

    if (entriesRes.error || defectsRes.error) {
      console.error('Supabase error in production trend:', entriesRes.error || defectsRes.error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const entries = entriesRes.data || [];
    const defects = defectsRes.data || [];

    // Group by date
    const dateMap: Record<string, { confirmed_units: number; defects: number }> = {};
    entries.forEach((e: { entry_date: string; quantity: number }) => {
      const d = e.entry_date;
      if (!dateMap[d]) dateMap[d] = { confirmed_units: 0, defects: 0 };
      dateMap[d].confirmed_units += e.quantity;
    });

    defects.forEach((d: { created_at: string; quantity: number }) => {
      const date = d.created_at.split('T')[0];
      if (!dateMap[date]) dateMap[date] = { confirmed_units: 0, defects: 0 };
      dateMap[date].defects += d.quantity;
    });

    const result = Object.entries(dateMap)
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Production trend GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
