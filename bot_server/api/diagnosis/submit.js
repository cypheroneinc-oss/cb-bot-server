import crypto from 'node:crypto';
import questions from '../../data/questions.v1.js';
import { runDiagnosis, QUESTION_VERSION } from '../../lib/scoring.js';
import {
  saveAnswers,
  saveScores,
  saveResult,
  getShareCardImage,
  createOrReuseSession
} from '../../lib/persistence.js';

const QUESTION_COUNT = 25;
const QUESTION_MAP = new Map(questions.map((question) => [question.id, question]));

function normalizeAnswers(rawAnswers, requestId) {
  if (!Array.isArray(rawAnswers) || rawAnswers.length !== QUESTION_COUNT) {
    throw Object.assign(new Error('answers must be 25 items'), {
      statusCode: 400,
      requestId
    });
  }

  const seen = new Set();
  const normalized = [];

  for (const answer of rawAnswers) {
    const questionId = answer?.questionId ?? answer?.question_id;
    const choiceKey = answer?.choiceKey ?? answer?.choice_key;

    if (typeof questionId !== 'string' || typeof choiceKey !== 'string') {
      throw Object.assign(new Error('Invalid answer format'), {
        statusCode: 400,
        requestId
      });
    }

    if (seen.has(questionId)) {
      throw Object.assign(new Error(`Duplicate answer for ${questionId}`), {
        statusCode: 400,
        requestId
      });
    }
    seen.add(questionId);

    const question = QUESTION_MAP.get(questionId);
    if (!question) {
      throw Object.assign(new Error(`Unknown question id: ${questionId}`), {
        statusCode: 400,
        requestId
      });
    }

    const choiceExists = question.choices.some((choice) => choice.key === choiceKey);
    if (!choiceExists) {
      throw Object.assign(new Error(`Unknown choice ${choiceKey} for ${questionId}`), {
        statusCode: 400,
        requestId
      });
    }

    normalized.push({ questionId, choiceKey });
  }

  return normalized;
}

export function createSubmitHandler({
  runDiagnosisFn = runDiagnosis,
  createOrReuseSessionFn = createOrReuseSession,
  saveAnswersFn = saveAnswers,
  saveScoresFn = saveScores,
  saveResultFn = saveResult,
  getShareCardImageFn = getShareCardImage
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const requestId = crypto.randomUUID?.() || String(Date.now());

    try {
      const payload =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};

      const { userId, sessionId: inputSessionId, answers } = payload;

      if (typeof userId !== 'string' || userId.length === 0) {
        res
          .status(400)
          .json({ ok: false, error: 'userId required', errorId: requestId });
        return;
      }

      if (inputSessionId && typeof inputSessionId !== 'string') {
        res
          .status(400)
          .json({ ok: false, error: 'sessionId must be a string', errorId: requestId });
        return;
      }

      let normalizedAnswers;
      try {
        normalizedAnswers = normalizeAnswers(answers, requestId);
      } catch (validationError) {
        if (validationError.statusCode === 400) {
          res.status(400).json({
            ok: false,
            error: validationError.message,
            errorId: requestId
          });
          return;
        }
        throw validationError;
      }

      const sessionInfo = inputSessionId
        ? { sessionId: inputSessionId }
        : await createOrReuseSessionFn({ userId, version: QUESTION_VERSION });

      const sessionId = sessionInfo.sessionId;

      const diagnosis = runDiagnosisFn(normalizedAnswers, sessionId);

      await saveAnswersFn({
        sessionId,
        answers: normalizedAnswers.map(({ questionId, choiceKey }) => ({
          question_id: questionId,
          choice_key: choiceKey
        }))
      });

      const factorScores = diagnosis.scores;
      await saveScoresFn({ sessionId, factorScores, total: factorScores.total });
      await saveResultFn({
        sessionId,
        cluster: diagnosis.cluster,
        heroSlug: diagnosis.heroSlug
      });

      const imageUrl = await getShareCardImageFn(diagnosis.heroSlug);

      res.status(200).json({
        ok: true,
        sessionId,
        questionSetVersion: QUESTION_VERSION,
        cluster: diagnosis.cluster,
        clusterScores: diagnosis.clusterScores,
        heroSlug: diagnosis.heroSlug,
        imageUrl,
        factorScores,
        total: factorScores.total
      });
    } catch (error) {
      console.error('[submit]', requestId, error);
      res.status(500).json({ ok: false, error: 'internal', errorId: requestId });
    }
  };
}

export default createSubmitHandler();
