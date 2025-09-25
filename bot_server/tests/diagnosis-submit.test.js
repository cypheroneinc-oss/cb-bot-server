import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    jsonPayload: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(payload) {
      this.jsonPayload = payload;
      this.body = payload;
      return this;
    }
  };
}

test('returns 404 when session is missing', async (t) => {
  const { createSubmitHandler } = await import('../api/diagnosis/submit.js');

  const ensureSessionMock = mock.fn(async () => ({
    sessionId: 'missing',
    userId: null,
    persisted: false,
    exists: false
  }));
  const persistAnswersMock = mock.fn(async () => {
    throw new Error('persistAnswers should not be called when session is missing');
  });
  const persistScoresMock = mock.fn(async () => {
    throw new Error('persistScores should not be called when session is missing');
  });
  const persistAssignmentMock = mock.fn(async () => {
    throw new Error('persistAssignment should not be called when session is missing');
  });

  const handler = createSubmitHandler({
    ensureSessionFn: ensureSessionMock,
    persistAnswersFn: persistAnswersMock,
    persistScoresFn: persistScoresMock,
    persistAssignmentFn: persistAssignmentMock,
    runDiagnosisFn: () => ({
      scores: { total: 0 },
      cluster: 'challenge',
      clusterScores: {},
      heroSlug: 'oda'
    }),
    buildFlexMessageFn: () => ({})
  });

  const req = {
    method: 'POST',
    body: {
      sessionId: 'missing',
      answers: [{ questionId: 'Q1', choiceKey: 'A' }]
    }
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.jsonPayload, {
    error: 'SessionNotFound',
    message: 'セッションが無効です。LINEから診断を開始し直してください。'
  });
  assert.equal(ensureSessionMock.mock.callCount(), 1);
  assert.equal(persistAnswersMock.mock.callCount(), 0);
  assert.equal(persistScoresMock.mock.callCount(), 0);
  assert.equal(persistAssignmentMock.mock.callCount(), 0);
});
