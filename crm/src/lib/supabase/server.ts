import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function createServerClient(isAdmin = false) {
  // We no longer pass the mes_auth_token to Supabase because it's a custom JWT 
  // and would cause 'JWSError JWSInvalidSignature' in PostgREST.
  // For server-side CRM actions, we rely on the SERVICE_ROLE_KEY (for admin) 
  // or the ANON_KEY (for public routes with limited RLS).

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    isAdmin ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'shveyka' },
      global: {
        headers: {}, // Disable custom auth headers that interfere with Supabase's own key handling
      },
    }
  );
}

export const createClient = createServerClient;
