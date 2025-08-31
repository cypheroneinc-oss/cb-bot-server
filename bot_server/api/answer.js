// /bot_server/api/answer.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { line, demographics, answers, result, barnum, meta } = req.body || {};

    // 最低限のバリデーション
    if (!line?.userId || !answers || !result) {
      return res.status(400).json({ ok:false, error:'invalid payload' });
    }

    const payload = {
      line,           // {userId, displayName, pictureUrl, ...}
      demographics,   // {gender, age, mbti}
      answers,        // 各設問の回答（q1..q8, q3は配列）
      result,         // {type, why, fit, jobs, adv}
      barnum: barnum ?? null, // ["～タイプ", ...]
      meta:   meta   ?? null  // {ts, ua, v, ...}
    };

    const { data, error } = await supabase
      .from('responses')
      .insert(payload)
      .select('id, created_at')
      .single();

    if (error) throw error;

    res.status(200).json({ ok:true, id:data.id, created_at:data.created_at });
  } catch (e) {
    console.error('[answer] insert error:', e);
    res.status(500).json({ ok:false, error:String(e.message || e) });
  }
}
