import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Admin client (bypasses RLS) — for server-side operations only
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Anon client — for user-context operations
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
