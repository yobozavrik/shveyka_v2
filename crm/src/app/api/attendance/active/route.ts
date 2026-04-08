import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient();

    // Get employees with 'active' status in employee_attendance
    const { data, error } = await supabase
      .from('employee_attendance')
      .select('employee_id')
      .eq('status', 'active');

    if (error) {
      console.error('Supabase error Attendance Active GET:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const activeIds = (data || []).map(row => row.employee_id);
    return NextResponse.json(activeIds);
  } catch (e: any) {
    console.error('Attendance Active GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
