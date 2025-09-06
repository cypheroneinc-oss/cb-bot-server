 // /api/answer.js
  // *** ランタイム注記：Node.js ランタイムを前提。Edge
  Runtime不可な場合は注意 ***
  import { createClient } from '@supabase/supabase-js';

  // --- Supabase（サービスロール）
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  // サーバ側でも保険で再計算
  function computeScoring(ab = {}) {
    let challenge = 0, plan = 0;
    if (ab.q1 === 'A') challenge++; else if (ab.q1 === 'B') plan++;
    if (ab.q2 === 'A') challenge++; else if (ab.q2 === 'B') plan++;
    if (ab.q5 === 'A') challenge++; else plan++;
    if (ab.q6 === 'A') challenge++; else plan++;
    if (ab.q7 === 'A') challenge++; else plan++;
    if (ab.q8 === 'B') challenge++; else plan++;
    const typeKey =
      (challenge - plan >= 2) ? 'challenge' :
      (plan - challenge >= 2) ? 'plan' : 'balance';
    return { challenge, plan, typeKey };
  }

  // 受け取った body を「今のresponsesスキーマ」に合わせて整形
  function toResponsesRow(body = {}) {
    const isV2 = !!body.line || !!body.answers;

    const line = isV2 ? (body.line ?? null) : {
      userId: body.userId,
      displayName: body.displayName ?? null,
      pictureUrl: body.pictureUrl ?? null
    };
    const line_user_id = line?.userId ?? body.userId ?? null;

    // demographics
    const demographics = isV2 ? (body.demographics ?? null) : {
      gender: body.gender ?? null,
      age: body.age ?? null,
      mbti: body.mbti ?? null
    };

    // answers（v2ならそのまま、v1っぽければ変換）
    let answers;
    if (isV2) {
      const ab = body.answers?.ab ?? {};
      const mot = body.answers?.motivation_ordered ?? body.answers?.q3
  ?? [];
      answers = { ab, motivation_ordered: Array.isArray(mot) ? mot : []
  };
    } else {
      const ab = {
        q1: body.answers?.q1, q2: body.answers?.q2, q4:
  body.answers?.q4,
        q5: body.answers?.q5, q6: body.answers?.q6, q7:
  body.answers?.q7, q8: body.answers?.q8
      };
      const mot = body.answers?.q3 ?? [];
      answers = { ab, motivation_ordered: Array.isArray(mot) ? mot : []
  };
    }

    // scoring / result / barnum / meta
    const scoring = isV2 ? (body.scoring ?? computeScoring(answers.ab))
  : computeScoring(answers.ab);
    const result  = isV2 ? (body.result  ?? {}) : (body.result ?? {});
    const barnum  = Array.isArray(body.barnum) ? body.barnum :
  (result.barnum ?? []);

    // meta の安全化：既にオブジェクトならそのまま、文字列なら
  JSON.parse
    let meta;
    if (isV2) {
      const bodyMeta = body.meta ?? {};
      if (typeof bodyMeta === 'object') {
        meta = bodyMeta;
      } else if (typeof bodyMeta === 'string') {
        try {
          meta = JSON.parse(bodyMeta);
        } catch (_) {
          meta = { raw: bodyMeta, parseError: true };
        }
      } else {
        meta = {};
      }
    } else {
      meta = {
        ts: body.ts ?? new Date().toISOString(),
        ua: null, liffId: null, app: 'c-lab-liff', v: '2025-09'
      };
    }

    // responses.result_type は not null なので入れる（ここを差し替え）
    const result_type = (result?.typeKey || scoring?.typeKey ||
  'balance');

    return {
      line_user_id,
      line, demographics,
      answers,           // jsonb not null
      scoring, result,   // jsonb
      barnum, meta,      // jsonb
      result_type        // text not null
      // created_at はDBのdefaultに任せる
    };
  }

  // ヘルスチェック（環境変数の有無も確認）
  export default async function handler(req, res) {
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
      return res.status(405).json({ ok:false, error:'Method Not Allowed'
   });
    }

    try {
      const row = toResponsesRow(req.body || {});

      if (!row.line_user_id) {
        console.warn('[answer] missing line_user_id. body=', req.body);
        return res.status(400).json({ ok:false, error:'missing userId'
  });
      }
      if (!row.answers) row.answers = { ab: {}, motivation_ordered: []
  }; // 念のため

      // メイン行の挿入
      const { data, error } = await supabase
        .from('responses')
        .insert(row)
        .select('id, created_at')
        .single();

      if (error) throw error;

      // ----------
  正規化テーブルにも同時保存（任意／失敗しても本体は成功のまま）
  ----------
      const respId = data.id; // uuid
      try {
        const ab = row.answers?.ab || {};
        const abRows = Object.entries(ab)
          .filter(([k,v]) => v)
          .map(([k,v]) => ({ response_id: respId, question_key: k,
  choice: String(v) }));
        if (abRows.length) {
          await supabase.from('answers_ab').insert(abRows);
        }

        const mot = (row.answers?.motivation_ordered || []).slice(0,3);
        const motRows = mot.map((m, idx) => ({
          response_id: respId, rank: idx+1, motivation: String(m)
        }));
        if (motRows.length) {
          await supabase.from('motivation_picks').insert(motRows);
        }
      } catch (e2) {
        console.warn('[answer] normalize insert skipped:', e2?.message
  || e2);
      }
      //
