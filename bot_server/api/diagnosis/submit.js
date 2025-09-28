import crypto from 'node:crypto';
import { score, QUESTION_VERSION, mapLikertToChoice, runDiagnosis } from '../../lib/scoring/index.js';
import { getQuestionDataset } from '../../lib/questions/index.js';
import {
  saveAnswers,
  saveResult,
  getShareCardImage,
  createOrReuseSession,
} from '../../lib/persistence.js';
import {
  getClusterLabel,
  getClusterNarrative,
  getHeroProfile,
} from '../../lib/result-content.js';

export const config = { runtime: 'nodejs' };

const QUESTION_SET = getQuestionDataset(QUESTION_VERSION);
const QUESTION_MAP = new Map(QUESTION_SET.map((question) => [question.code, question]));
const EXPECTED_COUNT = QUESTION_SET.length;

const MBTI_KEYS = ['E', 'I', 'N', 'S', 'T', 'F', 'J', 'P'];
const WORKSTYLE_KEYS = ['improv', 'structured', 'logical', 'intuitive', 'speed', 'careful'];
const MOTIVATION_KEYS = [
  'achieve',
  'autonomy',
  'connection',
  'security',
  'curiosity',
  'growth',
  'contribution',
  'approval',
];

function toNumeric(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.round(numeric * 100) / 100;
}

function mapCounts(keys, group = {}) {
  return keys.reduce((acc, key) => {
    acc[key] = toNumeric(group?.[key]);
    return acc;
  }, {});
}

function buildScoresBreakdown(counts = {}) {
  return {
    MBTI: mapCounts(MBTI_KEYS, counts.MBTI),
    WorkStyle: mapCounts(WORKSTYLE_KEYS, counts.WorkStyle),
    Motivation: mapCounts(MOTIVATION_KEYS, counts.Motivation),
  };
}

function resolveBaseUrl() {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const prefix = vercel.startsWith('http') ? vercel : `https://${vercel}`;
    return prefix.replace(/\/$/, '');
  }
  const site = process.env.BASE_URL?.trim();
  if (site) {
    return site.replace(/\/$/, '');
  }
  return 'https://example.com';
}

function normalizeAnswer(answer) {
  const code =
    answer?.code ?? answer?.questionId ?? answer?.question_id ?? answer?.id ?? null;
  const key = answer?.key ?? answer?.choiceKey ?? answer?.choice_key ?? null;
  const scaleRaw = answer?.scale ?? answer?.value ?? null;
  const scaleMaxRaw =
    answer?.scaleMax ??
    answer?.maxScale ??
    answer?.scale_range ??
    answer?.scaleRange ??
    null;
  const scale = scaleRaw === null || scaleRaw === undefined ? null : Number(scaleRaw);
  const scaleMax =
    scaleMaxRaw === null || scaleMaxRaw === undefined ? null : Number(scaleMaxRaw);
  return { code, key, scale, scaleMax };
}

function validateAnswers(rawAnswers, requestId) {
  if (!Array.isArray(rawAnswers) || rawAnswers.length !== EXPECTED_COUNT) {
    return {
      ok: false,
      error: `answers must be ${EXPECTED_COUNT} items`,
      errorId: requestId,
    };
  }

  const seen = new Set();
  const normalized = [];
  const persistencePayload = [];

  for (const rawAnswer of rawAnswers) {
    const { code, key, scale, scaleMax } = normalizeAnswer(rawAnswer);
    if (typeof code !== 'string') {
      return {
        ok: false,
        error: 'Invalid answer format',
        errorId: requestId,
      };
    }

    if (seen.has(code)) {
      return {
        ok: false,
        error: `Duplicate answer for ${code}`,
        errorId: requestId,
      };
    }
    seen.add(code);

    const question = QUESTION_MAP.get(code);
    if (!question) {
      return {
        ok: false,
        error: `Unknown question id: ${code}`,
        errorId: requestId,
      };
    }

    const numericScale = scale === null ? null : Number(scale);
    const numericScaleMax = scaleMax === null ? null : Number(scaleMax);

    if (numericScale !== null && !Number.isFinite(numericScale)) {
      return {
        ok: false,
        error: `Invalid scale value for ${code}`,
        errorId: requestId,
      };
    }

    if (numericScaleMax !== null && !Number.isFinite(numericScaleMax)) {
      return {
        ok: false,
        error: `Invalid scaleMax value for ${code}`,
        errorId: requestId,
      };
    }

    let resolvedKey = key;
    let weight = typeof rawAnswer?.w === 'number' ? rawAnswer.w : undefined;
    let resolvedScale = numericScale;
    let resolvedScaleMax = numericScaleMax;

    if (typeof resolvedKey !== 'string') {
      if (!Number.isFinite(resolvedScale)) {
        return {
          ok: false,
          error: `Scale required for ${code}`,
          errorId: requestId,
        };
      }
      const mapped = mapLikertToChoice({ questionId: code, scale: resolvedScale, scaleMax: resolvedScaleMax });
      if (!mapped || typeof mapped.choiceKey !== 'string') {
        return {
          ok: false,
          error: `Invalid scale for ${code}`,
          errorId: requestId,
        };
      }
      resolvedKey = mapped.choiceKey;
      weight = mapped.w;
      if (!Number.isFinite(resolvedScaleMax)) {
        resolvedScaleMax = 6;
      }
    }

    const match = question.choices.some((choice) => choice.key === resolvedKey);
    if (!match) {
      return {
        ok: false,
        error: `Unknown choice ${resolvedKey} for ${code}`,
        errorId: requestId,
      };
    }

    if (!Number.isFinite(resolvedScale)) {
      return {
        ok: false,
        error: `Scale required for ${code}`,
        errorId: requestId,
      };
    }

    const scaleMaxForStore = Number.isFinite(resolvedScaleMax) ? resolvedScaleMax : 6;

    normalized.push({ code, key: resolvedKey, w: weight, scale: resolvedScale, scaleMax: scaleMaxForStore });
    persistencePayload.push({ qid: code, choice: resolvedKey, scale: resolvedScale, scale_max: scaleMaxForStore });
  }

  if (normalized.length !== EXPECTED_COUNT) {
    return {
      ok: false,
      error: 'answers must cover all questions',
      errorId: requestId,
    };
  }

  return { ok: true, normalized, persistencePayload };
}

export function createSubmitHandler({
  scoreFn = score,
  createOrReuseSessionFn = createOrReuseSession,
  saveAnswersFn = saveAnswers,
  saveResultFn = saveResult,
  getShareCardImageFn = getShareCardImage,
  runDiagnosisFn = runDiagnosis,
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const requestId = crypto.randomUUID?.() || String(Date.now());

    try {
      const body = req.body ?? {};
      const { userId, sessionId: inputSessionId, answers, version } = body;

      if (!userId) {
        return res
          .status(400)
          .json({ ok: false, error: 'userId required', errorId: requestId });
      }

      if (inputSessionId && typeof inputSessionId !== 'string') {
        return res.status(400).json({
          ok: false,
          error: 'sessionId must be a string',
          errorId: requestId,
        });
      }

      const questionVersion = version ?? QUESTION_VERSION;
      if (questionVersion !== QUESTION_VERSION) {
        return res.status(400).json({
          ok: false,
          error: 'Unsupported question set version',
          errorId: requestId,
        });
      }

      const validation = validateAnswers(answers, requestId);
      if (!validation.ok) {
        return res.status(400).json(validation);
      }

      const { normalized, persistencePayload } = validation;

      const sessionId = inputSessionId
        ? inputSessionId
        : (await createOrReuseSessionFn({ userId, version: QUESTION_VERSION })).sessionId;

      await saveAnswersFn({ sessionId, answers: persistencePayload });

      const scoring = scoreFn(normalized, QUESTION_VERSION);
      const preparedForDiagnosis = normalized.map((item) => ({
        questionId: item.code,
        choiceKey: item.key,
        ...(typeof item.w === 'number' ? { w: item.w } : {}),
      }));
      const diagnosis = runDiagnosisFn(preparedForDiagnosis);

      const clusterKey = scoring.cluster ?? diagnosis?.cluster;
      const heroSlug = scoring.heroSlug ?? diagnosis?.heroSlug;

      const heroProfile = getHeroProfile(heroSlug);
      const clusterLabel = getClusterLabel(clusterKey);
      const narrative = getClusterNarrative(clusterKey);

      const counts = diagnosis?.counts ?? {};
      const scoresBreakdown = buildScoresBreakdown(counts);

      const shareCardUrl = await getShareCardImageFn(heroSlug);
      const cardImageUrl = shareCardUrl ?? heroProfile.avatarUrl;
      const baseUrl = resolveBaseUrl();
      const shareUrl = `${baseUrl}/share/${sessionId}`;

      await saveResultFn({
        sessionId,
        cluster: clusterKey,
        heroSlug,
        heroName: heroProfile.name,
        scores: {
          factors: scoring.factorScores,
          breakdown: scoresBreakdown,
        },
        shareCardUrl: cardImageUrl,
      });

      return res.status(200).json({
        sessionId,
        cluster: { key: clusterKey, label: clusterLabel },
        hero: {
          slug: heroSlug,
          name: heroProfile.name,
          avatarUrl: heroProfile.avatarUrl,
        },
        scores: scoresBreakdown,
        share: {
          url: shareUrl,
          cardImageUrl,
          copy: {
            headline: `あなたは${heroProfile.name}！`,
            summary: narrative.summary1line,
          },
        },
        narrative: {
          summary1line: narrative.summary1line,
          strengths: narrative.strengths,
          misfit_env: narrative.misfit_env,
          how_to_use: narrative.how_to_use,
          next_action: narrative.next_action,
        },
      });
    } catch (error) {
      console.error('[diagnosis:submit]', requestId, error);
      return res
        .status(500)
        .json({ ok: false, error: 'internal', errorId: requestId });
    }
  };
}

export default createSubmitHandler();
