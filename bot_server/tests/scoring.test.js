import test from 'node:test';
import assert from 'node:assert/strict';
import { runDiagnosis, decideHero, pickStable } from '../lib/scoring.js';
import { getQuestionDataset } from '../lib/questions/index.js';

const QUESTIONS = getQuestionDataset();

function buildAnswers(choiceMap) {
  return QUESTIONS.map((question) => ({
    questionId: question.code,
    choiceKey: choiceMap[question.code] ?? question.choices[0].key,
  }));
}

const challengeAnswers = {
  Q1: 'POS',
  Q2: 'POS',
  Q3: 'POS',
  Q4: 'NEG',
  Q5: 'POS',
  Q6: 'POS',
  Q7: 'NEG',
  Q8: 'NEG',
  Q9: 'POS',
  Q10: 'NEG',
  Q11: 'NEG',
  Q12: 'POS',
  Q13: 'NEG',
  Q14: 'NEG',
  Q15: 'POS',
  Q16: 'POS',
  Q17: 'POS',
  Q18: 'NEG',
  Q19: 'NEG',
  Q20: 'POS',
  Q21: 'POS',
  Q22: 'POS',
  Q23: 'NEG',
  Q24: 'NEG',
  Q25: 'POS'
};

test('runDiagnosis end-to-end for challenge archetype', () => {
const result = runDiagnosis(buildAnswers(challengeAnswers), 'seed');
assert.equal(result.cluster, 'challenge');
assert.equal(result.heroSlug, 'oda');
assert.equal(result.scores.total <= 100, true);
});

function makeCounts(partial) {
return {
MBTI: {},
WorkStyle: {},
Motivation: {},
NG: {},
Sync: {},
ClusterHints: {},
...partial,
MBTI: { ...(partial.MBTI ?? {}) },
WorkStyle: { ...(partial.WorkStyle ?? {}) },
Motivation: { ...(partial.Motivation ?? {}) },
NG: { ...(partial.NG ?? {}) },
Sync: { ...(partial.Sync ?? {}) },
ClusterHints: { ...(partial.ClusterHints ?? {}) }
};
}

const heroExpectations = [
{ cluster: 'challenge', expected: 'oda', counts: makeCounts({
WorkStyle: { speed: 3 },
Motivation: { achieve: 3 },
Sync: { high_tension: 3 }
}) },
{ cluster: 'challenge', expected: 'napoleon', counts: makeCounts({
WorkStyle: { structured: 2 },
Motivation: { achieve: 3 },
Sync: { high_tension: 1 }
}) },
{ cluster: 'challenge', expected: 'ryoma', counts: makeCounts({
MBTI: { N: 3 },
Motivation: { autonomy: 3 },
Sync: { high_tension: 0 }
}) },
{ cluster: 'challenge', expected: 'galileo', counts: makeCounts({
MBTI: { T: 3 },
Motivation: { achieve: 1 }
}) },
{ cluster: 'creative', expected: 'picasso', counts: makeCounts({
WorkStyle: { improv: 5 },
Motivation: { growth: 1 }
}) },
{ cluster: 'creative', expected: 'beethoven', counts: makeCounts({
Sync: { quiet_hot: 2, relaxed: 2 },
WorkStyle: { improv: 1 }
}) },
{ cluster: 'creative', expected: 'murasaki', counts: makeCounts({
WorkStyle: { careful: 3 },
Motivation: { curiosity: 3 }
}) },
{ cluster: 'creative', expected: 'davinci', counts: makeCounts({
WorkStyle: { intuitive: 3 },
Motivation: { growth: 3 }
}) },
{ cluster: 'support', expected: 'mother_teresa', counts: makeCounts({
Motivation: { connection: 4 }
}) },
{ cluster: 'support', expected: 'shibusawa', counts: makeCounts({
Motivation: { growth: 3 },
WorkStyle: { structured: 2 }
}) },
{ cluster: 'support', expected: 'rikyu', counts: makeCounts({
Motivation: { security: 3 },
Sync: { relaxed: 3 }
}) },
{ cluster: 'support', expected: 'nightingale', counts: makeCounts({
WorkStyle: { careful: 3 },
Motivation: { contribution: 3 }
}) },
{ cluster: 'strategy', expected: 'shotoku', counts: makeCounts({
Motivation: { contribution: 2 },
Sync: { natural: 2 }
}) },
{ cluster: 'strategy', expected: 'date', counts: makeCounts({
Motivation: { autonomy: 3 }
}) },
{ cluster: 'strategy', expected: 'einstein', counts: makeCounts({
Motivation: { curiosity: 3 },
WorkStyle: { logical: 3 }
}) },
{ cluster: 'strategy', expected: 'ieyasu', counts: makeCounts({
Motivation: { security: 3 },
WorkStyle: { structured: 3 }
}) }
];

for (const scenario of heroExpectations) {
  test(`decideHero selects ${scenario.expected}`, () => {
    const hero = decideHero(scenario.cluster, scenario.counts, 'session');
    assert.equal(hero, scenario.expected);
  });
}

test('pickStable produces deterministic choice', () => {
  const pool = ['a', 'b', 'c'];
  const first = pickStable(pool, 'alpha');
  const second = pickStable(pool, 'alpha');
  assert.equal(first, second);
});

test('cluster diversity for random answers', () => {
  const totals = new Map();
  for (let i = 0; i < 400; i += 1) {
    const answers = QUESTIONS.map((question) => {
      const choice = question.choices[Math.floor(Math.random() * question.choices.length)];
      return { questionId: question.code, choiceKey: choice.key };
    });
    const result = runDiagnosis(answers, `rand-${i}`);
    totals.set(result.cluster, (totals.get(result.cluster) ?? 0) + 1);
  }
  assert.equal(totals.size, 4);
});