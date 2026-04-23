import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.employeeId) {
    const supabase = getSupabaseAdmin('shveyka');
    const { data: employee } = await supabase
      .from('employees')
      .select('id, full_name, position, employee_number, phone, status')
      .eq('id', user.employeeId)
      .single();

    return NextResponse.json({ ...user, employee });
  }

  return NextResponse.json(user);
}
