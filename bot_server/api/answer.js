export default async function handler(req, res) {
  // ↓ 追加：ヘルスチェック（環境変数が読めてるかも確認）
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      env: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
      }
    });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }
  // （以降は現在の処理のまま）


// /bot_server/api/answer.js
import { createClient } from '@supabase/supabase-js';

// --- Supabase Client（サービスロールで）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// 旧/新どちらの形式でもスコアを再計算（保険）
function computeScoring(ab = {}) {
  let challenge = 0, plan = 0;
  if (ab.q1 === 'A') challenge++; else if (ab.q1 === 'B') plan++;
  if (ab.q2 === 'A') challenge++; else if (ab.q2 === 'B') plan++;
  if (ab.q5 === 'A') challenge++; else plan++;
  if (ab.q6 === 'A') challenge++; else plan++;
  if (ab.q7 === 'A') challenge++; else plan++;
  if (ab.q8 === 'B') challenge++; else plan++;
  const typeKey = (challenge - plan >= 2) ? 'challenge'
                 : (plan - challenge >= 2) ? 'plan'
                 : 'balance';
  return { challenge, plan, typeKey };
}

// 受け取った body を responses テーブルの列に合わせて正規化
function normalize(body = {}) {
  // --- v2（line / demographics / answers / scoring ...） or v1（userId 直置き）の両対応
  const isV2 = !!body.line || !!body.answers?.ab;

  const line_user_id      = isV2 ? body.line?.userId       : body.userId;
  const line_display_name = isV2 ? body.line?.displayName  : body.displayName ?? null;
  const line_picture_url  = isV2 ? body.line?.pictureUrl   : body.pictureUrl ?? null;

  const gender = isV2 ? body.demographics?.gender : body.gender ?? null;
  const age    = isV2 ? body.demographics?.age    : (body.age ?? null);
  const mbti   = isV2 ? body.demographics?.mbti   : body.mbti ?? null;

  // A/B 回答
  const ab = isV2
    ? (body.answers?.ab ?? {})
    : { q1: body.answers?.q1, q2: body.answers?.q2, q4: body.answers?.q4,
        q5: body.answers?.q5, q6: body.answers?.q6, q7: body.answers?.q7, q8: body.answers?.q8 };

  // やる気スイッチ（順位）
  const motArr = isV2
    ? (body.answers?.motivation_ordered ?? body.answers?.q3 ?? [])
    : (body.answers?.q3 ?? []);
  const motivation1 = motArr[0] ?? null;
  const motivation2 = motArr[1] ?? null;
  const motivation3 = motArr[2] ?? null;

  // スコアは保険でサーバ側でも算出
  const scoring = isV2 ? (body.scoring || computeScoring(ab)) : computeScoring(ab);

  // 診断結果
  const result = isV2 ? (body.result || {}) : (body.result || {});
  const type_key    = scoring.typeKey || result.typeKey || null;
  const type_title  = result.typeTitle ?? null;
  const tagline     = result.tagline   ?? null;
  const style       = result.style     ?? null;
  const jobs        = result.jobs      ?? null;  // jsonb[] 列想定
  const advice      = result.advice    ?? null;

  const barnum      = Array.isArray(body.barnum) ? body.barnum : (result.barnum ?? null);

  // メタ
  const meta_ts     = body.meta?.ts ?? body.ts ?? new Date().toISOString();
  const meta_ua     = body.meta?.ua ?? (typeof navigator === 'undefined' ? null : navigator.userAgent);
  const meta_liffId = body.meta?.liffId ?? null;
  const meta_app    = body.meta?.app ?? 'c-lab-liff';
  const meta_v      = body.meta?.v   ?? '2025-09';

  return {
    line_user_id, line_display_name, line_picture_url,
    gender, age, mbti,
    q1: ab.q1 ?? null, q2: ab.q2 ?? null, q4: ab.q4 ?? null, q5: ab.q5 ?? null,
    q6: ab.q6 ?? null, q7: ab.q7 ?? null, q8: ab.q8 ?? null,
    motivation1, motivation2, motivation3,
    challenge: scoring.challenge, plan: scoring.plan, type_key,
    type_title, tagline, style, jobs, advice,
    barnum,
    meta_ts, meta_ua, meta_liff_id: meta_liffId, meta_app, meta_v
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const row = normalize(req.body || {});
    if (!row.line_user_id) {
      console.warn('[answer] missing line_user_id. body=', req.body);
      return res.status(400).json({ ok:false, error:'missing userId' });
    }

    // 1行挿入
    const { data, error } = await supabase
      .from('responses')
      .insert(row)
      .select('id, created_at')
      .single();

    if (error) throw error;

    // 確認用ログ（VercelのFunctionsログで見える）
    console.log('[answer] inserted:', data);

    return res.status(200).json({ ok:true, id:data.id, created_at:data.created_at });
  } catch (e) {
    console.error('[answer] insert error:', e);
    return res.status(500).json({ ok:false, error:String(e.message || e) });
  }
}
