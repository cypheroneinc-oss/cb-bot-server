// filename: bot_server/api/diagnosis/submit.js
// Minimal-diff: 既存フローを保持しつつ、v3(30問)は安全な“直通ルート”で採点・保存・返却。
// - v3 は answers を柔軟に受け取り score() が内部で正規化
// - 保存は additive（既存 scores を壊さず hexaco/balance/idealTop3/industryTop5/archetype を追加）
// - v1系は従来どおり mapLikertToChoice → scoreAndMapToHero/runDiagnosis

import crypto from 'node:crypto';
import {
  score,
  QUESTION_VERSION,
  mapLikertToChoice,
  runDiagnosis,            // 互換用（従来スコア）
} from '../../lib/scoring/index.js';

import { getQuestionDataset } from '../../lib/questions/index.js';

import {
  saveAnswers,
  saveResult,
  getShareCardImage,
  createOrReuseSession,
  logSubmission,
} from '../../lib/persistence.js';

import {
  getClusterLabel,
  getClusterNarrative,
  getHeroProfile,
} from '../../lib/result-content.js';

import { mapToArchetype, TYPE_KEYS } from '../../lib/archetype-mapper.js';

export const config = { runtime: 'nodejs' };

function resolveBaseUrl(){
  const explicit = process.env.APP_BASE_URL?.trim(); if (explicit) return explicit.replace(/\/$/,'');
  const vercel = process.env.VERCEL_URL?.trim(); if (vercel){ const p = vercel.startsWith('http')? vercel : `https://${vercel}`; return p.replace(/\/$/,''); }
  const site = process.env.BASE_URL?.trim(); if (site) return site.replace(/\/$/,''); return 'https://example.com';
}

function normalizeQuestionVersion(input){
  const raw = input == null ? '' : String(input).trim();
  if (!raw) return String(QUESTION_VERSION).toLowerCase();
  const v = raw.toLowerCase();
  const current = String(QUESTION_VERSION).toLowerCase();
  const aliases = new Map([
    ['v1', current],
    ['1', current],
    [current, current],
    ['3', '3'],
    ['v3', '3'],
  ]);
  return aliases.get(v) ?? v;
}

const MBTI_KEYS = ['E', 'I', 'N', 'S', 'T', 'F', 'J', 'P'];
const WORKSTYLE_KEYS = ['improv', 'structured', 'logical', 'intuitive', 'speed', 'careful'];
const MOTIVATION_KEYS = ['achieve','autonomy','connection','security','curiosity','growth','contribution','approval'];

function toNumeric(v){ const n = Number(v ?? 0); return Number.isFinite(n) ? Math.round(n*100)/100 : 0; }
function mapCounts(keys, group = {}){ return keys.reduce((a,k)=>{ a[k]=toNumeric(group?.[k]); return a; },{}); }
function buildScoresBreakdown(counts = {}) {
  return {
    MBTI: mapCounts(MBTI_KEYS, counts.MBTI),
    WorkStyle: mapCounts(WORKSTYLE_KEYS, counts.WorkStyle),
    Motivation: mapCounts(MOTIVATION_KEYS, counts.Motivation)
  };
}

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

function buildMapperInput({ scoring, diagnosis }) {
  const base = typeof scoring?.factorScores === 'object' && scoring.factorScores
    ? scoring.factorScores
    : {};
  const counts = diagnosis?.counts || {};
  const flatCounts = {
    ...(counts.MBTI || {}),
    ...(counts.WorkStyle || {}),
    ...(counts.Motivation || {}),
  };
  return { ...flatCounts, ...base };
}

const TYPE_TO_CLUSTER_FALLBACK = {
  hero: 'challenge', outlaw: 'challenge',
  explorer: 'freedom', creator: 'creation',
  sage: 'intellect', magician: 'transformation',
  caregiver: 'support', ruler: 'governance',
  everyman: 'harmony', jester: 'play',
  lover: 'affection', innocent: 'hope',
};

// ---- v1系の回答正規化と検証（既存ロジック維持） ----
function normalizeAnswer(a){
  const code = a?.code ?? a?.questionId ?? a?.question_id ?? a?.id ?? null;
  const key  = a?.key ?? a?.choiceKey ?? a?.choice_key ?? null;
  const scaleRaw = a?.scale ?? a?.value ?? null;
  const scaleMaxRaw = a?.scaleMax ?? a?.maxScale ?? a?.scale_range ?? a?.scaleRange ?? null;
  const scale = scaleRaw == null ? null : Number(scaleRaw);
  const scaleMax = scaleMaxRaw == null ? null : Number(scaleMaxRaw);
  return { code, key, scale, scaleMax };
}

function validateAnswersV1(rawAnswers, questionSet, requestId){
  const QUESTION_MAP = new Map(questionSet.map((q) => [q.code, q]));
  const EXPECTED_COUNT = questionSet.length;

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

    if (typeof resolvedKey !== 'string'){
      if (!Number.isFinite(resolvedScale)) return { ok:false, error:`Scale required for ${code}`, errorId:requestId };
      const mapped = mapLikertToChoice({ questionId: code, scale: resolvedScale, scaleMax: resolvedScaleMax });
      if (!mapped || typeof mapped.choiceKey !== 'string') return { ok:false, error:`Invalid scale for ${code}`, errorId:requestId };
      resolvedKey = mapped.choiceKey; weight = mapped.w;
      if (!Number.isFinite(resolvedScaleMax)) resolvedScaleMax = 6;
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

// ---- v3系の回答最小検証（柔軟に受けてscore()に委譲） ----
function normalizeAnswersV3(raw, questionSet) {
  const codes = new Set(questionSet.map(q => q.code));
  const dict = {};

  if (Array.isArray(raw)) {
    for (const a of raw) {
      const id = a?.code ?? a?.questionId ?? a?.question_id ?? a?.id;
      const val = a?.scale ?? a?.value ?? a?.answer ?? a?.val;
      const n = Number(val);
      if (id && codes.has(id) && Number.isFinite(n) && n >= 1 && n <= 6) {
        dict[id] = n;
      }
    }
  } else if (raw && typeof raw === 'object') {
    for (const k of Object.keys(raw)) {
      const n = Number(raw[k]);
      if (codes.has(k) && Number.isFinite(n) && n >= 1 && n <= 6) {
        dict[k] = n;
      }
    }
  }
  return dict;
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
      const resolvedVersion = normalizeQuestionVersion(body.version ?? body.questionSetVersion);

      const { userId, sessionId: inputSessionId, answers } = body;
      if (!userId) return res.status(400).json({ ok:false, error:'userId required', errorId:requestId });
      if (inputSessionId && typeof inputSessionId !== 'string') return res.status(400).json({ ok:false, error:'sessionId must be a string', errorId:requestId });

      // v3 以外は既存の厳格チェック
      const expectedLegacy = String(QUESTION_VERSION).toLowerCase();
      const isV3 = resolvedVersion === '3';
      if (!isV3 && resolvedVersion !== expectedLegacy){
        return res.status(400).json({
          ok:false,
          error:`Unsupported question set version (expected: "${expectedLegacy}" or "3", got: "${resolvedVersion || 'none'}")`,
          errorId:requestId,
        });
      }

      // セッション確保（フォールバック可）
      let sessionId = inputSessionId;
      if (!sessionId){
        try {
          const r = await createOrReuseSessionFn({ userId, version: isV3 ? '3' : QUESTION_VERSION });
          sessionId = r?.sessionId || crypto.randomUUID?.() || String(Date.now());
        } catch (e){
          console.warn('[submit:createOrReuseSession]', requestId, e?.message || e);
          sessionId = crypto.randomUUID?.() || String(Date.now());
        }
      }

      // ---- v3: 直通スコアリング ----
      if (isV3) {
        const qset = getQuestionDataset('3');
        const dict = normalizeAnswersV3(answers, qset);

        // 最低限の件数チェック（全問必須）
        if (Object.keys(dict).length !== qset.length) {
          return res.status(400).json({ ok:false, error:`answers must be ${qset.length} items`, errorId:requestId });
        }

        // 採点
        const result = await scoreFn(dict, '3'); // score() が v3 を委譲

        // 回答保存（choice 未使用。スキーマ互換のため 'NA' を入れる）
        const persistencePayload = Object.keys(dict).map((code)=>({
          qid: code, choice: 'NA', scale: Number(dict[code]), scale_max: 6
        }));
        try { await saveAnswersFn({ sessionId, answers: persistencePayload }); }
        catch (e){ console.warn('[submit:saveAnswers:v3]', requestId, e?.message || e); }

        // ヒーロー/クラスタ
        const heroSlug = (result?.archetype?.key || 'hero').toLowerCase();
        const clusterKey = TYPE_TO_CLUSTER_FALLBACK[heroSlug] || 'challenge';

        const heroProfile = getHeroProfile(heroSlug);
        const clusterLabel = getClusterLabel(clusterKey);
        const narrative = getClusterNarrative(clusterKey);

        // 共有カード
        let cardImageUrl = heroProfile?.avatarUrl;
        try { const shareCardUrl = await getShareCardImageFn(heroSlug); if (shareCardUrl) cardImageUrl = shareCardUrl; }
        catch (e){ console.warn('[submit:getShareCardImage:v3]', requestId, e?.message || e); }

        const baseUrl = resolveBaseUrl();
        const shareUrl = `${baseUrl}/share/${sessionId}`;

        // 結果保存（additive）
        try {
          await saveResultFn({
            sessionId,
            cluster: clusterKey,
            heroSlug,
            heroName: heroProfile?.name,
            scores: {
              // v3 追加
              hexaco: result.hexaco,
              balance: result.balance,
              archetype: result.archetype,
              idealTop3: result.idealTop3,
              industryTop5: result.industryTop5,
            },
            shareCardUrl: cardImageUrl,
            version: '3',
          });
        } catch (e){
          console.warn('[submit:saveResult:v3]', requestId, e?.message || e);
        }

        // レスポンス（v3本体＋互換フィールド）
        return res.status(200).json({
          version: '3',
          sessionId,
          // v3本体
          hexaco: result.hexaco,
          balance: result.balance,
          archetype: result.archetype,
          idealTop3: result.idealTop3,
          industryTop5: result.industryTop5,
          // 互換
          cluster: { key: clusterKey, label: clusterLabel },
          hero: { slug: heroSlug, name: heroProfile?.name, avatarUrl: heroProfile?.avatarUrl },
          share: {
            url: shareUrl,
            cardImageUrl,
            copy: { headline: `あなたは${heroProfile?.name}！`, summary: narrative?.summary1line || '' },
          },
          narrative: {
            summary1line: narrative?.summary1line || '',
            strengths: narrative?.strengths || [],
            misfit_env: narrative?.misfit_env || [],
            how_to_use: narrative?.how_to_use || [],
            next_action: narrative?.next_action || [],
          },
        });
      }

      // ---- v1系: 既存ルート ----
      const questionSetLegacy = getQuestionDataset(QUESTION_VERSION);
      const validation = validateAnswersV1(answers, questionSetLegacy, requestId);
      if (!validation.ok) return res.status(400).json(validation);
      const { normalized, persistencePayload } = validation;

      try { await saveAnswersFn({ sessionId, answers: persistencePayload }); }
      catch (e){ console.warn('[submit:saveAnswers]', requestId, e?.message || e); }

      const scoring = scoreFn(normalized, QUESTION_VERSION);
      const prepared = normalized.map((it)=>({ questionId: it.code, choiceKey: it.key, ...(typeof it.w==='number'?{w:it.w}:{}) }));
      const diagnosis = runDiagnosisFn(prepared);

      let heroSlug;
      try {
        const mapperInput = buildMapperInput({ scoring, diagnosis });
        heroSlug = mapToArchetype(mapperInput);
        if (!TYPE_KEYS.includes(heroSlug)) throw new Error('mapper returned unknown type');
      } catch (e) {
        console.warn('[submit:mapToArchetype]', requestId, e?.message || e);
        heroSlug = (scoring?.heroSlug || diagnosis?.heroSlug || 'hero').toLowerCase();
      }

      const clusterKey =
        scoring?.cluster ||
        diagnosis?.cluster ||
        TYPE_TO_CLUSTER_FALLBACK[heroSlug] ||
        'challenge';

      const heroProfile = getHeroProfile(heroSlug);
      const clusterLabel = getClusterLabel(clusterKey);
      const narrative = getClusterNarrative(clusterKey);

      const counts = diagnosis?.counts ?? {};
      const scoresBreakdown = buildScoresBreakdown(counts);

      let cardImageUrl = heroProfile?.avatarUrl;
      try { const shareCardUrl = await getShareCardImageFn(heroSlug); if (shareCardUrl) cardImageUrl = shareCardUrl; }
      catch (e){ console.warn('[submit:getShareCardImage]', requestId, e?.message || e); }

      const baseUrl = resolveBaseUrl();
      const shareUrl = `${baseUrl}/share/${sessionId}`;

      try {
        await saveResultFn({
          sessionId,
          cluster: clusterKey,
          heroSlug,
          heroName: heroProfile?.name,
          scores: { factors: scoring?.factorScores, breakdown: scoresBreakdown },
          shareCardUrl: cardImageUrl,
          version: String(QUESTION_VERSION),
        });
      } catch (e){
        console.warn('[submit:saveResult]', requestId, e?.message || e);
      }

      // 既存レスポンス
      return res.status(200).json({
        sessionId,
        cluster: { key: clusterKey, label: clusterLabel },
        hero: { slug: heroSlug, name: heroProfile?.name, avatarUrl: heroProfile?.avatarUrl },
        scores: scoresBreakdown,
        share: {
          url: shareUrl,
          cardImageUrl,
          copy: { headline: `あなたは${heroProfile?.name}！`, summary: narrative?.summary1line || '' },
        },
        narrative: {
          summary1line: narrative?.summary1line || '',
          strengths: narrative?.strengths || [],
          misfit_env: narrative?.misfit_env || [],
          how_to_use: narrative?.how_to_use || [],
          next_action: narrative?.next_action || [],
        },
      });
    } catch (error){
      console.error('[diagnosis:submit]', requestId, error, error?.stack);
      return res.status(500).json({ ok:false, error:String(error?.message || error), errorId:requestId });
    }
  };
}

export default createSubmitHandler();