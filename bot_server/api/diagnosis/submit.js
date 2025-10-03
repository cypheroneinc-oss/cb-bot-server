// Minimal-diff: 現行の安全対策/ログ設計を維持。
// mapLikertToChoice をそのまま利用できるよう、answers の正規化は現行踏襲。
// （左=YES の 6段Likert を使う場合、フロントが scaleMax=6 を渡せばOK）

import crypto from 'node:crypto';
import { score, QUESTION_VERSION, mapLikertToChoice, runDiagnosis } from '../../lib/scoring/index.js';
import { getQuestionDataset } from '../../lib/questions/index.js';
import {
  saveAnswers,
  saveResult,
  getShareCardImage,
  createOrReuseSession,
  logSubmission, // ★ 既存ログ連携
} from '../../lib/persistence.js';
import {
  getClusterLabel,
  getClusterNarrative,
  getHeroProfile,
} from '../../lib/result-content.js';

export const config = { runtime: 'nodejs' };

const QUESTION_SET = getQuestionDataset(QUESTION_VERSION);
const QUESTION_MAP = new Map(QUESTION_SET.map((q) => [q.code, q]));
const EXPECTED_COUNT = QUESTION_SET.length;

const MBTI_KEYS = ['E', 'I', 'N', 'S', 'T', 'F', 'J', 'P'];
const WORKSTYLE_KEYS = ['improv', 'structured', 'logical', 'intuitive', 'speed', 'careful'];
const MOTIVATION_KEYS = ['achieve','autonomy','connection','security','curiosity','growth','contribution','approval'];

function toNumeric(v){ const n = Number(v ?? 0); return Number.isFinite(n) ? Math.round(n*100)/100 : 0; }
function mapCounts(keys, group = {}){ return keys.reduce((a,k)=>{ a[k]=toNumeric(group?.[k]); return a; },{}); }
function buildScoresBreakdown(counts = {}) {
  return { MBTI: mapCounts(MBTI_KEYS, counts.MBTI), WorkStyle: mapCounts(WORKSTYLE_KEYS, counts.WorkStyle), Motivation: mapCounts(MOTIVATION_KEYS, counts.Motivation) };
}
function resolveBaseUrl(){
  const explicit = process.env.APP_BASE_URL?.trim(); if (explicit) return explicit.replace(/\/$/,'');
  const vercel = process.env.VERCEL_URL?.trim(); if (vercel){ const p = vercel.startsWith('http')? vercel : `https://${vercel}`; return p.replace(/\/$/,''); }
  const site = process.env.BASE_URL?.trim(); if (site) return site.replace(/\/$/,''); return 'https://example.com';
}

// version / questionSetVersion のゆらぎ + v1/1 を現行版にエイリアス
function normalizeQuestionVersion(input){
  const raw = input == null ? '' : String(input).trim();
  if (!raw) return String(QUESTION_VERSION).toLowerCase();
  const v = raw.toLowerCase();
  const current = String(QUESTION_VERSION).toLowerCase();
  const aliases = new Map([ ['v1', current], ['1', current], [current, current] ]);
  return aliases.get(v) ?? v;
}

function normalizeAnswer(a){
  const code = a?.code ?? a?.questionId ?? a?.question_id ?? a?.id ?? null;
  const key  = a?.key ?? a?.choiceKey ?? a?.choice_key ?? null;
  const scaleRaw = a?.scale ?? a?.value ?? null;
  const scaleMaxRaw = a?.scaleMax ?? a?.maxScale ?? a?.scale_range ?? a?.scaleRange ?? null;
  const scale = scaleRaw == null ? null : Number(scaleRaw);
  const scaleMax = scaleMaxRaw == null ? null : Number(scaleMaxRaw);
  return { code, key, scale, scaleMax };
}

function validateAnswers(rawAnswers, requestId){
  if (!Array.isArray(rawAnswers) || rawAnswers.length !== EXPECTED_COUNT){
    return { ok:false, error:`answers must be ${EXPECTED_COUNT} items`, errorId:requestId };
  }
  const seen = new Set(); const normalized=[]; const persistencePayload=[];
  for (const raw of rawAnswers){
    const { code, key, scale, scaleMax } = normalizeAnswer(raw);
    if (typeof code !== 'string') return { ok:false, error:'Invalid answer format', errorId:requestId };
    if (seen.has(code)) return { ok:false, error:`Duplicate answer for ${code}`, errorId:requestId };
    seen.add(code);

    const question = QUESTION_MAP.get(code);
    if (!question) return { ok:false, error:`Unknown question id: ${code}`, errorId:requestId };

    const nScale = scale===null ? null : Number(scale);
    const nMax   = scaleMax===null ? null : Number(scaleMax);
    if (nScale!==null && !Number.isFinite(nScale)) return { ok:false, error:`Invalid scale value for ${code}`, errorId:requestId };
    if (nMax!==null   && !Number.isFinite(nMax))   return { ok:false, error:`Invalid scaleMax value for ${code}`, errorId:requestId };

    let resolvedKey = key;
    let weight = typeof raw?.w === 'number' ? raw.w : undefined;
    let resolvedScale = nScale;
    let resolvedScaleMax = nMax;

    // Likertのみ（key未指定）でもOK。既存の mapLikertToChoice を利用。
    if (typeof resolvedKey !== 'string'){
      if (!Number.isFinite(resolvedScale)) return { ok:false, error:`Scale required for ${code}`, errorId:requestId };
      const mapped = mapLikertToChoice({ questionId: code, scale: resolvedScale, scaleMax: resolvedScaleMax });
      if (!mapped || typeof mapped.choiceKey !== 'string') return { ok:false, error:`Invalid scale for ${code}`, errorId:requestId };
      resolvedKey = mapped.choiceKey; weight = mapped.w;
      if (!Number.isFinite(resolvedScaleMax)) resolvedScaleMax = 6; // 左=YES の 6段
    }

    if (!question.choices.some((c)=>c.key===resolvedKey)) return { ok:false, error:`Unknown choice ${resolvedKey} for ${code}`, errorId:requestId };
    if (!Number.isFinite(resolvedScale)) return { ok:false, error:`Scale required for ${code}`, errorId:requestId };
    const scaleMaxForStore = Number.isFinite(resolvedScaleMax) ? resolvedScaleMax : 6;

    normalized.push({ code, key: resolvedKey, w: weight, scale: resolvedScale, scaleMax: scaleMaxForStore });
    persistencePayload.push({ qid: code, choice: resolvedKey, scale: resolvedScale, scale_max: scaleMaxForStore });
  }
  if (normalized.length !== EXPECTED_COUNT) return { ok:false, error:'answers must cover all questions', errorId:requestId };
  return { ok:true, normalized, persistencePayload };
}

// クライアント送信の任意メタをサニタイズ
function sanitizeDemographics(meta){
  const src = meta?.demographics || {};
  const pick = (v, len=20) => (v == null ? '' : String(v).slice(0, len));
  const gender = pick(src.gender);
  const age = pick(src.age, 3);
  const mbti = pick(src.mbti, 8).toUpperCase();
  const clean = { gender, age, mbti };
  if (!gender && !age && !mbti) return null;
  return clean;
}

export function createSubmitHandler({
  scoreFn = score,
  createOrReuseSessionFn = createOrReuseSession,
  saveAnswersFn = saveAnswers,
  saveResultFn = saveResult,
  getShareCardImageFn = getShareCardImage,
  runDiagnosisFn = runDiagnosis,
} = {}){
  return async function handler(req, res){
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

    const requestId = crypto.randomUUID?.() || String(Date.now());
    try {
      const body = req.body ?? {};
      const incomingVersionRaw = body.version ?? body.questionSetVersion ?? null;
      const resolvedIncomingVersion = normalizeQuestionVersion(incomingVersionRaw);
      const expectedVersion = String(QUESTION_VERSION).toLowerCase();

      const { userId, sessionId: inputSessionId, answers } = body;
      if (!userId) return res.status(400).json({ ok:false, error:'userId required', errorId:requestId });
      if (inputSessionId && typeof inputSessionId !== 'string') return res.status(400).json({ ok:false, error:'sessionId must be a string', errorId:requestId });

      if (resolvedIncomingVersion !== expectedVersion){
        return res.status(400).json({
          ok:false,
          error:`Unsupported question set version (expected: "${expectedVersion}", got: "${resolvedIncomingVersion || 'none'}")`,
          errorId:requestId,
        });
      }

      const validation = validateAnswers(answers, requestId);
      if (!validation.ok) return res.status(400).json(validation);
      const { normalized, persistencePayload } = validation;

      // セッションIDはDBに依存しない（フォールバックあり）
      let sessionId = inputSessionId;
      if (!sessionId){
        try {
          const r = await createOrReuseSessionFn({ userId, version: QUESTION_VERSION });
          sessionId = r?.sessionId || crypto.randomUUID?.() || String(Date.now());
        } catch (e){
          console.warn('[submit:createOrReuseSession]', requestId, e?.message || e);
          sessionId = crypto.randomUUID?.() || String(Date.now());
        }
      }

      // 回答保存はベストエフォート（失敗してもUIは進める）
      try { await saveAnswersFn({ sessionId, answers: persistencePayload }); }
      catch (e){ console.warn('[submit:saveAnswers]', requestId, e?.message || e); }

      // 採点・診断（互換の既存ロジックを利用）
      const scoring = scoreFn(normalized, QUESTION_VERSION);
      const prepared = normalized.map((it)=>({ questionId: it.code, choiceKey: it.key, ...(typeof it.w==='number'?{w:it.w}:{}) }));
      const diagnosis = runDiagnosisFn(prepared);

      const clusterKey = scoring.cluster ?? diagnosis?.cluster;
      const heroSlug = scoring.heroSlug ?? diagnosis?.heroSlug;
      const heroProfile = getHeroProfile(heroSlug);
      const clusterLabel = getClusterLabel(clusterKey);
      const narrative = getClusterNarrative(clusterKey);
      const counts = diagnosis?.counts ?? {};
      const scoresBreakdown = buildScoresBreakdown(counts);

      // 共有画像はフォールバック
      let cardImageUrl = heroProfile?.avatarUrl;
      try { const shareCardUrl = await getShareCardImageFn(heroSlug); if (shareCardUrl) cardImageUrl = shareCardUrl; }
      catch (e){ console.warn('[submit:getShareCardImage]', requestId, e?.message || e); }

      const baseUrl = resolveBaseUrl();
      const shareUrl = `${baseUrl}/share/${sessionId}`;

      // 結果保存もベストエフォート
      try {
        await saveResultFn({
          sessionId,
          cluster: clusterKey,
          heroSlug,
          heroName: heroProfile?.name,
          scores: { factors: scoring.factorScores, breakdown: scoresBreakdown },
          shareCardUrl: cardImageUrl,
        });
      } catch (e){
        console.warn('[submit:saveResult]', requestId, e?.message || e);
      }

      // 任意ログ（失敗してもUI継続）
      try {
        const demographics = sanitizeDemographics(body?.meta);
        await logSubmission({
          userId,
          sessionId,
          client: String(body?.client || 'liff'),
          version: String(QUESTION_VERSION),
          // answers は最小限の形にサニタイズ
          answers: normalized.map(({ code, scale, scaleMax }) => ({ code, scale, scaleMax })),
          demographics,
          resultSummary: {
            hero: { slug: heroSlug, name: heroProfile?.name },
            cluster: { key: clusterKey, label: clusterLabel },
            share: { url: shareUrl },
          },
        }, req);
      } catch (e) {
        console.warn('[submit:logSubmission]', requestId, e?.message || e);
      }

      // 成功レスポンス（UIが進むことを最優先）
      return res.status(200).json({
        sessionId,
        cluster: { key: clusterKey, label: clusterLabel },
        hero: { slug: heroSlug, name: heroProfile?.name, avatarUrl: heroProfile?.avatarUrl },
        scores: scoresBreakdown,
        share: {
          url: shareUrl,
          cardImageUrl,
          copy: { headline: `あなたは${heroProfile?.name}！`, summary: narrative.summary1line },
        },
        narrative: {
          summary1line: narrative.summary1line,
          strengths: narrative.strengths,
          misfit_env: narrative.misfit_env,
          how_to_use: narrative.how_to_use,
          next_action: narrative.next_action,
        },
      });
    } catch (error){
      console.error('[diagnosis:submit]', requestId, error, error?.stack);
      return res.status(500).json({ ok:false, error:String(error?.message || error), errorId:requestId });
    }
  };
}

export default createSubmitHandler();
