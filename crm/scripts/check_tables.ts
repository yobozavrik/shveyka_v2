import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase.rpc('get_tables_in_shveyka');
  if (error) {
    // If RPC doesn't exist, try a direct query (if allowed) or just list from information_schema
    const { data: tables, error: tablesErr } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'shveyka');
    
    if (tablesErr) {
      console.error('Error fetching tables:', tablesErr);
      return;
    }
    console.log('Tables in shveyka schema:', tables.map(t => t.tablename));
  } else {
    console.log('Tables in shveyka schema (via RPC):', data);
  }
}

checkTables();
