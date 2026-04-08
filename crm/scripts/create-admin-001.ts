import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' }
});

async function main() {
  console.log('Creating admin user 001...');

  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .upsert(
      {
        employee_number: '001',
        full_name: 'Super Admin',
        position: 'Administrator',
        department: 'Administration',
        is_active: true
      },
      { onConflict: 'employee_number' }
    )
    .select()
    .single();

  if (empErr) {
    console.error('Failed to create employee:', empErr);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash('0000', 10);

  const { error: userErr } = await supabase.from('users').upsert(
    {
      username: 'admin001',
      hashed_password: hashedPassword,
      role: 'admin',
      employee_id: emp.id,
      is_active: true
    },
    { onConflict: 'username' }
  );

  if (userErr) {
    console.error('Failed to create user:', userErr);
    process.exit(1);
  }

  console.log('Admin user 001 created successfully');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
