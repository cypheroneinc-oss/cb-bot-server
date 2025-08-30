import { supabase } from '../lib/supabase.js';
import { scoreToType } from '../lib/scorer.js';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const origin = req.headers.origin;
    const allow = (process.env.ALLOW_ORIGINS || '').split(',').map(s=>s.trim());
    if (allow.length && origin && !allow.includes(origin)) {
      return res.status(403).json({ error: 'forbidden origin' });
    }

    const { line_user_id, answers } = req.body || {};
    if (!line_user_id || !answers) {
      return res.status(400).json({ error: 'bad request' });
    }

    const result = scoreToType(answers);

    // 保存（jsonb）
    const { error } = await supabase
      .from('responses')
      .insert({ line_user_id, answers, result_type: result.result_type });

    if (error) return res.status(500).json({ error: error.message });

    // LIFF へ返却（レンダリング用に必要十分の情報を返す）
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
