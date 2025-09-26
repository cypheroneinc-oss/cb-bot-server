let admin = null;

const { createClient } = await import('@supabase/supabase-js');

export function getSupabaseAdmin() {
  if (admin) {
    return admin;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error('[supabase] Missing SUPABASE_URL or SERVICE_ROLE/ANON key');
  }

  admin = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE) {
    console.warn(
      '[supabase] SERVICE_ROLE key not set. Using ANON key as fallback.'
    );
  }

  return admin;
}
