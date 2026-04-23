import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim().replace(/^"|"$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'shveyka' }
});

async function listStages() {
  const { data, error } = await supabase
    .from('production_stages')
    .select('*')
    .order('sequence_order');
  
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

listStages();
