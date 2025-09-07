// pages/api/answer.js  (Next.js API Route)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function computeScoring(ab = {}) {
  let c = 0, p = 0;
  if (ab.q1 === 'A') c++; else if (ab.q1 === 'B') p++;
  if (ab.q2 === 'A') c++; else if (ab.q2 === 'B') p++;
  if (ab.q5 === 'A') c++; else p++;
  if (ab.q6 === 'A') c++; else p++;
  if (ab.q7 === 'A') c++; else p++;
  if (ab.q8 === 'B') c++; else p++;
  const typeKey = (c - p >= 2) ? 'challenge' : (p - c >= 2) ? 'plan' : 'balance';
  return { challenge: c, plan: p, typeKey };
}

export default async function handler(req, res) {
  // CORS（必要なら許可ドメインを限定）
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET')     return res.status(200).json({ ok: true });

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});

    // スコアはサーバ側でも再計算して保存の整合性担保
    const ab      = body?.answers?.ab || {};
    const scoring = computeScoring(ab);
    const row     = { ...body, scoring };

    const { data, error } = await supabase
      .from('responses')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[Supabase insert error]', error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    console.error('[API error]', e);
    return res.status(500).json({ ok: false, error: e?.message || 'server error' });
  }
}
