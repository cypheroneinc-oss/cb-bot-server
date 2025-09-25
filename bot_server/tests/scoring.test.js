import test from 'node:test';
import assert from 'node:assert/strict';
import { runDiagnosis, decideHero, pickStable } from '../lib/scoring.js';
import questions from '../data/questions.v1.json' assert { type: 'json' };

function buildAnswers(choiceMap) {
  return questions.map((question) => ({
    questionId: question.id,
    choiceKey: choiceMap[question.id] ?? question.choices[0].key
  }));
}

const challengeAnswers = {
  Q1: 'A',
  Q2: 'A',
  Q3: 'A',
  Q4: 'A',
  Q5: 'B',
  Q6: 'A',
  Q7: 'A',
  Q8: 'A',
  Q9: 'A',
  Q10: 'A',
  Q11: 'A',
  Q12: 'A',
  Q13: 'A',
  Q14: 'A',
  Q15: 'A',
  Q16: 'D',
  Q17: 'A',
  Q18: 'A',
  Q19: 'A',
  Q20: 'A',
  Q21: 'A',
  Q22: 'A',
  Q23: 'C',
  Q24: 'A',
  Q25: 'A'
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
    const answers = questions.map((question) => {
      const choice = question.choices[Math.floor(Math.random() * question.choices.length)];
      return { questionId: question.id, choiceKey: choice.key };
    });
    const result = runDiagnosis(answers, `rand-${i}`);
    totals.set(result.cluster, (totals.get(result.cluster) ?? 0) + 1);
  }
  assert.equal(totals.size, 4);
});
