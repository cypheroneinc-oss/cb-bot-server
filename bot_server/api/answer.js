// /api/answer.js  （Vercel Node Serverless Function / Next.js API 両対応のCJS）
/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

// --- ランタイム保護（Edge で require が落ちるのを防ぐ） ---
module.exports.config = { api: { bodyParser: true, externalResolver: true, runtime: 'nodejs18.x' } };

// ---- 小ユーティリティ ----
function safeJson(b) {
  if (!b) return null;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return null; }
  }
  return b;
}
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

module.exports = async function handler(req, res) {
  // 1) ヘルスチェック（GETで叩くと生存確認だけ返す）
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'answer api alive',
      node: process.versions?.node,
      has_env: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  // 2) 依存・環境変数のチェック
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({
      ok: false,
      error: 'Missing Supabase env',
      detail: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE
      }
    });
  }

  // 3) Supabase クライアントを確実に生成
  let supabase;
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'createClient failed', detail: String(e?.message || e) });
  }

  // 4) リクエストボディを安全に読む
  const body = safeJson(req.body) || {};
  const ab = body?.answers?.ab || {};
  const scoring = computeScoring(ab);
  const row = { ...body, scoring };

  // 5) DB insert （完全 try/catch）
  try {
    const { data, error } = await supabase.from('responses').insert(row).select().single();
    if (error) {
      // 典型：relation "responses" does not exist / RLS / invalid input 等
      return res.status(500).json({ ok: false, error: 'insert failed', detail: error.message });
    }
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'exception on insert', detail: String(e?.message || e) });
  }
};
