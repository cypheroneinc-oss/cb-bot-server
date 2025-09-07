// /api/answer.js  （プロジェクト直下または Next.js の /pages/api 配下）
/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

// --- ランタイム強制（Edge で require が落ちるのを防ぐ） ---
// Next.js API Routes なら有効。純Vercel Functionsでも無害。
module.exports.config = { api: { bodyParser: true, externalResolver: true }, runtime: 'nodejs' };

function safeJson(b) {
  // Vercel/Nextは req.body をオブジェクトにしてくれるが、
  // 代理CDN・一部構成だと文字列で届くことがある
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
  const t0 = Date.now();
  try {
    // --- ヘルスチェック（GET） ---
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        health: 'answer alive',
        // ここで Production 環境変数が見えているかを即確認できる
        env_seen: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
        },
        runtime: 'node',
        ts: new Date().toISOString(),
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    // --- Body 安全取得 ---
    const body = safeJson(req.body);
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid or empty JSON body' });
    }

    // --- Supabase クライアント生成（必ず Node ランタイムで） ---
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !key) {
      return res.status(500).json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE' });
    }
    const supabase = createClient(url, key);

    // --- 二重防御：スコアが未計算ならこちらで計算 ---
    const ab = body?.answers?.ab || {};
    const scoring = body.scoring || computeScoring(ab);

    const row = { ...body, scoring };

    // --- 挿入 ---
    const { data, error } = await supabase.from('responses').insert(row).select().single();
    if (error) {
      // 具体的なDBエラーをフロントで見られるよう返す（開発中のみ使える）
      console.error('Supabase insert error:', error);
      return res.status(500).json({ ok: false, error: String(error?.message || error) });
    }

    return res.status(200).json({ ok: true, id: data?.id, ms: Date.now() - t0 });
  } catch (e) {
    console.error('API fatal error:', e);
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
      where: 'top-level',
    });
  }
};
