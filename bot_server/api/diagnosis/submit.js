import crypto from 'node:crypto';
import { score, QUESTION_VERSION } from '../../lib/scoring/index.js';
import { getQuestionDataset } from '../../lib/questions/index.js';
import {
  saveAnswers,
  saveScores,
  saveResult,
  getShareCardImage,
  createOrReuseSession,
} from '../../lib/persistence.js';

export const config = { runtime: 'nodejs' };

const QUESTION_SET = getQuestionDataset(QUESTION_VERSION);
const QUESTION_MAP = new Map(QUESTION_SET.map((question) => [question.code, question]));
const EXPECTED_COUNT = QUESTION_SET.length;

function normalizeAnswer(answer) {
  const code =
    answer?.code ?? answer?.questionId ?? answer?.question_id ?? answer?.id ?? null;
  const key = answer?.key ?? answer?.choiceKey ?? answer?.choice_key ?? null;
  return { code, key };
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
    const { code, key } = normalizeAnswer(rawAnswer);
    if (typeof code !== 'string' || typeof key !== 'string') {
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

    const match = question.choices.some((choice) => choice.key === key);
    if (!match) {
      return {
        ok: false,
        error: `Unknown choice ${key} for ${code}`,
        errorId: requestId,
      };
    }

    normalized.push({ code, key });
    persistencePayload.push({ question_id: code, choice_key: key });
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
  saveScoresFn = saveScores,
  saveResultFn = saveResult,
  getShareCardImageFn = getShareCardImage,
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

      await saveScoresFn({ sessionId, factorScores: scoring.factorScores, total: scoring.total });
      await saveResultFn({ sessionId, cluster: scoring.cluster, heroSlug: scoring.heroSlug });

      const imageUrl = await getShareCardImageFn(scoring.heroSlug);

      return res.status(200).json({
        ok: true,
        sessionId,
        cluster: scoring.cluster,
        heroSlug: scoring.heroSlug,
        imageUrl,
        factorScores: scoring.factorScores,
        total: scoring.total,
        result: {
          version: QUESTION_VERSION,
          cluster: scoring.cluster,
          heroSlug: scoring.heroSlug,
          factorScores: scoring.factorScores,
          total: scoring.total,
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
