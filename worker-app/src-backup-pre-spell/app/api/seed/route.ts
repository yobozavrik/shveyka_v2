import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('0000', salt);
    const supabaseAdmin = getSupabaseAdmin('public');

    // 1. Employee
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .upsert({ employee_number: '001', full_name: 'Admin', status: 'active' }, { onConflict: 'employee_number' })
      .select().single();

    // 2. User
    await supabaseAdmin
      .from('users')
      .upsert({ 
        username: 'admin001', 
        hashed_password: hashedPassword, 
        role: 'admin', 
        employee_id: emp.id,
        is_active: true
      }, { onConflict: 'username' });

    return NextResponse.json({ success: true, message: 'Ready. Use 001 / 0000' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
