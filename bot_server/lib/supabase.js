import { createClient } from '@supabase/supabase-js';

let adminClient = null;

function resolveServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    null
  );
}

export function getSupabaseAdmin({ optional = false } = {}) {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = resolveServiceKey();

  if (!url || !serviceKey) {
    if (optional) {
      return null;
    }
    throw new Error('[supabase] Missing SUPABASE_URL or SERVICE_ROLE/ANON key');
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[supabase] SERVICE_ROLE_KEY not set. Using ANON key as fallback.');
  }

  return adminClient;
}
