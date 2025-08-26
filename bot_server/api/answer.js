import { supabase } from '../lib/supabase.js';
import { scoreToType, typeMessage } from '../lib/scorer.js';
export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).end();
  const origin = req.headers.origin;
  const allow = (process.env.ALLOW_ORIGINS || '').split(',').map(s=>s.trim());
  if (!allow.includes(origin)) return res.status(403).json({ error:'forbidden origin' });
  const { line_user_id, answers } = req.body || {};
  if (!line_user_id || !answers) return res.status(400).json({ error:'bad request' });
  const result_type = scoreToType(answers);
  const { error } = await supabase.from('responses').insert({ line_user_id, answers, result_type });
  if (error) return res.status(500).json({ error: error.message });
  const msg = typeMessage(result_type);
  return res.status(200).json({
    result_type,
    title: msg.title,
    body: msg.body,
    fit: msg.fit,
    cta: { label: 'もっと深く診断する（事前登録）', url: process.env.PRE_REGISTER_URL || '#' }
  });
}
