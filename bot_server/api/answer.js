// /bot_server/api/answer.js
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

// 旧(top-level) / 新(構造化) どちらでも受け取れるように正規化
function normalize(body = {}, ua = '') {
  // 新形式を優先
  const isNew = !!body.line || !!body.demographics;

  const line = isNew
    ? body.line
    : {
        userId: body.userId,
        displayName: body.displayName,
        pictureUrl: body.pictureUrl ?? null,
      };

  const demographics = isNew
    ? body.demographics
    : {
        gender: body.gender ?? body.answers?.gender ?? null,
        age: body.age ?? body.answers?.age ?? null,
        mbti: body.mbti ?? body.answers?.mbti ?? null,
      };

  const answers = isNew
    ? body.answers
    : body.answers ?? null;

  const scoring = body.scoring ?? null;

  // barnum は result 内でも独立でもどちらでも来る想定
  const result = body.result ?? null;
  const barnum = body.barnum ?? result?.barnum ?? null;

  const meta = {
    ...(body.meta ?? {}),
    ts: body.ts ?? body.meta?.ts ?? new Date().toISOString(),
    ua: body.meta?.ua ?? ua,
    v:  body.meta?.v  ?? 'v2',
  };

  return { line, demographics, answers, result, barnum, scoring, meta };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }
  if (!url || !serviceKey) {
    console.error('[answer] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
    return res.status(500).json({ ok:false, error:'Supabase env not set' });
  }

  try {
    const norm = normalize(req.body, req.headers['user-agent'] || '');
    // 最低限の必須
    if (!norm.line?.userId || !norm.answers || !norm.result) {
      return res.status(400).json({ ok:false, error:'invalid payload (userId/answers/result required)' });
    }

    // 分析用テーブル（jsonb カラム）に挿入
    const row = {
      line: norm.line,                 // jsonb
      demographics: norm.demographics, // jsonb
      answers: norm.answers,           // jsonb（AB回答・モチベ順などを格納）
      scoring: norm.scoring,           // jsonb（challenge/plan/typeKey）
      result: norm.result,             // jsonb（typeTitle 等）
      barnum: norm.barnum,             // jsonb（3行までの“当たってるかも”）
      meta: norm.meta,                 // jsonb（ts/ua/バージョンなど）
    };

    let inserted = null;

    const r1 = await supabase
      .from('responses')
      .insert([row])
      .select('id, created_at')
      .single();

    if (!r1.error) {
      inserted = { table: 'responses', ...r1.data };
    } else {
      console.warn('[answer] insert into responses failed -> fallback to responses_raw', r1.error);
      const r2 = await supabase
        .from('responses_raw')
        .insert([{ payload: { normalized: row, original: req.body } }])
        .select('id, created_at')
        .single();
      if (r2.error) {
        console.error('[answer] fallback insert failed', r2.error);
        return res.status(500).json({ ok:false, error:`DB error: ${r2.error.message}` });
      }
      inserted = { table: 'responses_raw', ...r2.data, note: 'fallback' };
    }

    return res.status(200).json({ ok:true, ...inserted });
  } catch (e) {
    console.error('[answer] exception', e);
    return res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
}
