import { createClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

export function getSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return createClient<any>(supabaseUrl, supabaseAnonKey);
}

// Cache Supabase admin clients per schema at module level
const supabaseAdminCache = new Map<string, any>();

export function getSupabaseAdmin(schema: string = 'public') {
  if (!supabaseAdminCache.has(schema)) {
    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
    supabaseAdminCache.set(schema, createClient<any>(supabaseUrl, supabaseServiceKey, {
      db: { schema: schema as any },
    }));
  }
  return supabaseAdminCache.get(schema)!;
}
