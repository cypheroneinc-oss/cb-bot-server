import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'nodejs' }; // なぜ: Edge では Supabase SDK が動作しないため

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`ENV ${name} is missing`);
  return value;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'));

    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('order', { ascending: true })
      .limit(25);

    if (error) {
      console.error('[diagnosis] supabase error', error); // なぜ: 失敗要因をログで即把握するため
      return res
        .status(500)
        .json({ error: error.message, code: error.code || 'SUPABASE_ERROR' });
    }

    return res.status(200).json({ questions: data || [] });
  } catch (error) {
    console.error('[diagnosis] fatal', error); // なぜ: 想定外例外の痕跡を残すため
    return res.status(500).json({ error: error?.message || String(error), code: 'FATAL' });
  }
}
