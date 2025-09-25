import { createClient } from '@supabase/supabase-js';

let supabaseClient;

function resolveServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    null
  );
}

export function getSupabaseClient({ optional = false } = {}) {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = resolveServiceRoleKey();

    if (!url || !key) {
      if (optional) {
        return null;
      }
      throw new Error('Supabase credentials are not configured');
    }

    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  }

  return supabaseClient;
}

export const supabase = getSupabaseClient({ optional: true });
