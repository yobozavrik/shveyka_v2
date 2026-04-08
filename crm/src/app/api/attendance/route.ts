import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth-server';

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createServerClient();

    // Get all attendance logs with employee names
    const { data, error } = await supabase
      .from('employee_attendance')
      .select(`
        *,
        employees (
          full_name,
          position
        )
      `)
      .order('check_in', { ascending: false });

    if (error) {
      console.error('Supabase error fetching attendance:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error('Attendance GET exception:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
