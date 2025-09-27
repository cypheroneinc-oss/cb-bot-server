import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createSubmitHandler } from '../api/diagnosis/submit.js';
import { getQuestionDataset } from '../lib/questions/index.js';

const QUESTIONS = getQuestionDataset();

function createResponse() {
  return {
    statusCode: 200,
    jsonPayload: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    }
  };
}

test('rejects non-POST methods', async () => {
  const handler = createSubmitHandler();
  const res = createResponse();

  await handler({ method: 'GET', body: null }, res);

  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.jsonPayload, { ok: false, error: 'Method Not Allowed' });
});

test('returns 400 when answers are incomplete', async () => {
  const handler = createSubmitHandler();
  const res = createResponse();

  await handler(
    { method: 'POST', body: { userId: 'user-1', answers: [] } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonPayload.ok, false);
  assert.equal(res.jsonPayload.error, 'answers must be 25 items');
  assert.ok(res.jsonPayload.errorId);
});

test('executes scoring pipeline and persistence on success', async () => {
  const answers = QUESTIONS.map((question) => ({
    code: question.code,
    key: question.choices[0].key
  }));

  const createOrReuseSessionFn = mock.fn(async () => ({ sessionId: 'session-123' }));
  const saveAnswersFn = mock.fn(async () => {});
  const saveScoresFn = mock.fn(async () => {});
  const saveResultFn = mock.fn(async () => {});
  const getShareCardImageFn = mock.fn(async () => 'https://example.com/image.png');

  const handler = createSubmitHandler({
    createOrReuseSessionFn,
    saveAnswersFn,
    saveScoresFn,
    saveResultFn,
    getShareCardImageFn,
    scoreFn: () => ({
      factorScores: {
        mbti: 10,
        safety: 10,
        workstyle: 10,
        motivation: 10,
        ng: 10,
        sync: 10,
        total: 60
      },
      total: 60,
      cluster: 'challenge',
      heroSlug: 'oda'
    })
  });

  const res = createResponse();

  await handler(
    { method: 'POST', body: { userId: 'user-1', answers } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonPayload, {
    ok: true,
    sessionId: 'session-123',
    cluster: 'challenge',
    heroSlug: 'oda',
    imageUrl: 'https://example.com/image.png',
    factorScores: {
      mbti: 10,
      safety: 10,
      workstyle: 10,
      motivation: 10,
      ng: 10,
      sync: 10,
      total: 60
    },
    total: 60,
    result: {
      version: 1,
      cluster: 'challenge',
      heroSlug: 'oda',
      factorScores: {
        mbti: 10,
        safety: 10,
        workstyle: 10,
        motivation: 10,
        ng: 10,
        sync: 10,
        total: 60
      },
      total: 60
    }
  });

  assert.equal(createOrReuseSessionFn.mock.callCount(), 1);
  assert.equal(saveAnswersFn.mock.callCount(), 1);
  assert.equal(saveScoresFn.mock.callCount(), 1);
  assert.equal(saveResultFn.mock.callCount(), 1);
  assert.equal(getShareCardImageFn.mock.callCount(), 1);
});

test('returns 500 when persistence fails', async () => {
  const answers = QUESTIONS.map((question) => ({
    code: question.code,
    key: question.choices[0].key
  }));

  const handler = createSubmitHandler({
    createOrReuseSessionFn: async () => ({ sessionId: 'session-err' }),
    saveAnswersFn: async () => {
      throw new Error('DB down');
    },
    scoreAndMapToHeroFn: () => ({
      factorScores: {
        mbti: 10,
        safety: 10,
        workstyle: 10,
        motivation: 10,
        ng: 10,
        sync: 10,
        total: 60
      },
      total: 60,
      cluster: 'challenge',
      heroSlug: 'oda'
    })
  });

  const res = createResponse();

  await handler(
    { method: 'POST', body: { userId: 'user-1', answers } },
    res
  );

  assert.equal(res.statusCode, 500);
  assert.equal(res.jsonPayload.ok, false);
  assert.equal(res.jsonPayload.error, 'internal');
  assert.ok(res.jsonPayload.errorId);
});
