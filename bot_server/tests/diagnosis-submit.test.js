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
    key: question.choices[0].key,
    scale: 1,
    scaleMax: 6
  }));

  const createOrReuseSessionFn = mock.fn(async () => ({ sessionId: 'session-123' }));
  const saveAnswersFn = mock.fn(async () => {});
  const saveResultFn = mock.fn(async () => {});
  const getShareCardImageFn = mock.fn(async () => 'https://example.com/image.png');
  const runDiagnosisFn = mock.fn(() => ({
    counts: {
      MBTI: { E: 3, I: 1 },
      WorkStyle: { improv: 2, structured: 1 },
      Motivation: { achieve: 2, autonomy: 1 }
    },
    scores: {},
    cluster: 'challenge',
    heroSlug: 'oda'
  }));

  const handler = createSubmitHandler({
    createOrReuseSessionFn,
    saveAnswersFn,
    saveResultFn,
    getShareCardImageFn,
    runDiagnosisFn,
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
    sessionId: 'session-123',
    cluster: { key: 'challenge', label: 'チャレンジ' },
    hero: {
      slug: 'oda',
      name: '織田信長タイプ',
      avatarUrl: 'https://placehold.co/512x512?text=oda'
    },
    scores: {
      MBTI: { E: 3, I: 1, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0 },
      WorkStyle: { improv: 2, structured: 1, logical: 0, intuitive: 0, speed: 0, careful: 0 },
      Motivation: {
        achieve: 2,
        autonomy: 1,
        connection: 0,
        security: 0,
        curiosity: 0,
        growth: 0,
        contribution: 0,
        approval: 0
      }
    },
    share: {
      url: 'https://example.com/share/session-123',
      cardImageUrl: 'https://example.com/image.png',
      copy: {
        headline: 'あなたは織田信長タイプ！',
        summary: '直感と行動で空気を切り開くフロントランナー。'
      }
    },
    narrative: {
      summary1line: '直感と行動で空気を切り開くフロントランナー。',
      strengths: ['初動が速い', '人前での牽引力', '未知にワクワクできる'],
      misfit_env: ['細かい手順の厳守だけを重視する現場', '自由度が極端に低い体制'],
      how_to_use: ['最初の火付け役を任せる', '0→1の検証タスクで先頭に置く', '議論の場で推進役を任命する'],
      next_action: ['今週、誰も手を出していない小タスクを自分発で提案→着手']
    }
  });

  assert.equal(createOrReuseSessionFn.mock.callCount(), 1);
  assert.equal(saveAnswersFn.mock.callCount(), 1);
  assert.equal(saveResultFn.mock.callCount(), 1);
  assert.equal(getShareCardImageFn.mock.callCount(), 1);
  assert.equal(runDiagnosisFn.mock.callCount(), 1);
});

test('returns 500 when persistence fails', async () => {
  const answers = QUESTIONS.map((question) => ({
    code: question.code,
    key: question.choices[0].key,
    scale: 1,
    scaleMax: 6
  }));

  const handler = createSubmitHandler({
    createOrReuseSessionFn: async () => ({ sessionId: 'session-err' }),
    saveAnswersFn: async () => {
      throw new Error('DB down');
    },
    runDiagnosisFn: () => ({
      counts: {},
      cluster: 'challenge',
      heroSlug: 'oda'
    }),
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

  assert.equal(res.statusCode, 500);
  assert.equal(res.jsonPayload.ok, false);
  assert.equal(res.jsonPayload.error, 'internal');
  assert.ok(res.jsonPayload.errorId);
});
