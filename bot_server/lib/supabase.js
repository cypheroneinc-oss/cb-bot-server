import { createClient } from '@supabase/supabase-js';

let supabaseClient;

export function getSupabaseClient({ optional = false } = {}) {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
