import crypto from 'node:crypto';
import questions from '../../data/questions.v1.js';
import { scoreAndMapToHero } from '../../lib/scoring.js';
import {
  saveAnswers,
  saveScores,
  saveResult,
  getShareCardImage,
  createOrReuseSession
} from '../../lib/persistence.js';

const QUESTION_COUNT = 25;
const QUESTION_LOOKUP = new Map(
  questions.map((question) => [question.id, question])
);

function validateAnswers(rawAnswers, requestId) {
  if (!Array.isArray(rawAnswers) || rawAnswers.length !== QUESTION_COUNT) {
    return {
      ok: false,
      error: 'answers must be 25 items',
      errorId: requestId
    };
  }

  const seen = new Set();
  const normalized = [];
  const persistencePayload = [];

  for (const answer of rawAnswers) {
    const questionId = answer?.questionId ?? answer?.question_id;
    const choiceKey = answer?.choiceKey ?? answer?.choice_key;

    if (typeof questionId !== 'string' || typeof choiceKey !== 'string') {
      return {
        ok: false,
        error: 'Invalid answer format',
        errorId: requestId
      };
    }

    if (seen.has(questionId)) {
      return {
        ok: false,
        error: `Duplicate answer for ${questionId}`,
        errorId: requestId
      };
    }
    seen.add(questionId);

    const question = QUESTION_LOOKUP.get(questionId);
    if (!question) {
      return {
        ok: false,
        error: `Unknown question id: ${questionId}`,
        errorId: requestId
      };
    }

    const choiceExists = question.choices.some((choice) => choice.key === choiceKey);
    if (!choiceExists) {
      return {
        ok: false,
        error: `Unknown choice ${choiceKey} for ${questionId}`,
        errorId: requestId
      };
    }

    normalized.push({ questionId, choiceKey });
    persistencePayload.push({ question_id: questionId, choice_key: choiceKey });
  }

  return { ok: true, normalized, persistencePayload };
}

export function createSubmitHandler({
  scoreAndMapToHeroFn = scoreAndMapToHero,
  createOrReuseSessionFn = createOrReuseSession,
  saveAnswersFn = saveAnswers,
  saveScoresFn = saveScores,
  saveResultFn = saveResult,
  getShareCardImageFn = getShareCardImage
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const requestId = crypto.randomUUID?.() || String(Date.now());

    try {
      const body = req.body ?? {};
      const { userId, sessionId: inputSessionId, answers } = body;

      if (!userId) {
        return res
          .status(400)
          .json({ ok: false, error: 'userId required', errorId: requestId });
      }

      if (inputSessionId && typeof inputSessionId !== 'string') {
        return res.status(400).json({
          ok: false,
          error: 'sessionId must be a string',
          errorId: requestId
        });
      }

      const validation = validateAnswers(answers, requestId);
      if (!validation.ok) {
        return res.status(400).json(validation);
      }

      const { normalized, persistencePayload } = validation;

      const sessionId = inputSessionId
        ? inputSessionId
        : (await createOrReuseSessionFn({ userId, version: 1 })).sessionId;

      await saveAnswersFn({ sessionId, answers: persistencePayload });

      const { factorScores, total, cluster, heroSlug } = scoreAndMapToHeroFn(
        normalized,
        questions
      );

      await saveScoresFn({ sessionId, factorScores, total });
      await saveResultFn({ sessionId, cluster, heroSlug });

      const imageUrl = await getShareCardImageFn(heroSlug);

      return res.status(200).json({
        ok: true,
        sessionId,
        cluster,
        heroSlug,
        imageUrl,
        factorScores,
        total
      });
    } catch (error) {
      console.error('[submit]', requestId, error);
      return res
        .status(500)
        .json({ ok: false, error: 'internal', errorId: requestId });
    }
  };
}

export default createSubmitHandler();
