import { runDiagnosis, QUESTION_VERSION } from '../../lib/scoring.js';
import { buildFlexMessage } from '../../lib/line.js';
import {
  ensureSession,
  persistAnswers,
  persistScores,
  persistAssignment
} from '../../lib/persistence.js';

export function createSubmitHandler({
  runDiagnosisFn = runDiagnosis,
  buildFlexMessageFn = buildFlexMessage,
  ensureSessionFn = ensureSession,
  persistAnswersFn = persistAnswers,
  persistScoresFn = persistScores,
  persistAssignmentFn = persistAssignment
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      let payload = req.body ?? {};
      if (typeof payload === 'string') {
        payload = JSON.parse(payload);
      }
      const { sessionId, answers, userId } = payload;

      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      if (!Array.isArray(answers)) {
        res.status(400).json({ error: 'answers must be an array' });
        return;
      }

      const session = await ensureSessionFn(sessionId, { userId });
      if (session.exists === false) {
        res.status(404).json({
          error: 'SessionNotFound',
          message: 'セッションが無効です。LINEから診断を開始し直してください。'
        });
        return;
      }

      const normalizedAnswers = answers.map((item) => ({
        questionId: item.questionId,
        choiceKey: item.choiceKey
      }));

      const result = runDiagnosisFn(normalizedAnswers, sessionId);

      await persistAnswersFn(sessionId, normalizedAnswers);
      await persistScoresFn(sessionId, result.scores);
      const assignment = await persistAssignmentFn(sessionId, result.cluster, result.heroSlug);

      const imageUrl = assignment.asset?.image_url ?? null;
      const flexMessage = buildFlexMessageFn({
        heroSlug: result.heroSlug,
        cluster: result.cluster,
        imageUrl,
        displayName: 'あなたの働き方スタイル',
        sessionId
      });

      res.status(200).json({
        sessionId,
        questionSetVersion: QUESTION_VERSION,
        scores: result.scores,
        cluster: result.cluster,
        clusterScores: result.clusterScores,
        heroSlug: result.heroSlug,
        flexMessage
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Diagnosis submission error', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}

export default createSubmitHandler();
