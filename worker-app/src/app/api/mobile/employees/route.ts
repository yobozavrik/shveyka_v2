import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Public list of employees for worker login (PIN-based)
export async function GET() {
  const shveykaClient = getSupabaseAdmin('shveyka');
  
  const { data, error } = await shveykaClient
    .from('employees')
    .select('id, full_name, position, department, photo_url, employee_number')
    .eq('status', 'active')
    .order('full_name');

  if (error) {
    console.error('Employees fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}
