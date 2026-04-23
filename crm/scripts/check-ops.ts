import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim().replace(/^"|"$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  db: { schema: 'shveyka' }
});

async function checkOperations() {
  const { data: stages } = await supabase.from('production_stages').select('id, name, code');
  const { data: operations } = await supabase.from('stage_operations').select('*');
  
  const result = stages?.map(s => ({
    stage: s.name,
    code: s.code,
    ops: operations?.filter(o => o.stage_id === s.id).map(o => ({ name: o.name, code: o.code }))
  }));

  console.log(JSON.stringify(result, null, 2));
}

checkOperations();
