// Cロジック診断・判定ユーティリティ v1
// 依存: /data/questions.v1.js（既に作成済み）
// 目的: 回答配列 → 下位因子25Dベクトル → 12アーキタイプ確率 → 主/サブタイプ + 指標

import QUESTIONS from "../data/questions.v1.js";

/**
 * 回答フォーマット
 * @typedef {Object} Answer
 * @property {string} id - 質問ID（QUESTIONS[].id と一致）
 * @property {number} value - 1..6 の整数（6法同意）
 */

/** 下位因子キー一覧（25D） */
export const SUBFACTORS = {
  Trait: ["Extraversion", "Conscientiousness", "Openness", "Agreeableness", "Neuroticism"],
  Value: ["Autonomy", "Achievement", "Security", "Universalism", "Stimulation", "Power"],
  Motivation: ["Autonomy", "Competence", "Relatedness", "Safety"],
  Orientation: ["Promotion", "Prevention"],
  Interest: ["Artistic", "Social", "Enterprising", "Investigative", "Realistic", "Conventional"],
  Fit: ["PsychSafety", "Flexibility", "Trust", "Collaboration"],
};

/**
 * 初期重み行列（12タイプ × 下位因子25D）
 * 合計=1.0/タイプ を基本方針に近似。
 * 本番では /lib/archetype-weights.v1.json に外出しして学習で更新。
 */
export const ARCHETYPE_WEIGHTS = {
  Hero: {
    Trait: { Extraversion: 0.11, Conscientiousness: 0.09, Openness: 0.02, Agreeableness: 0.02, Neuroticism: -0.04 },
    Value: { Achievement: 0.06, Autonomy: 0.03, Security: 0.02, Universalism: 0.01, Stimulation: 0.02, Power: 0.00 },
    Motivation: { Competence: 0.07, Relatedness: 0.04, Autonomy: 0.03, Safety: 0.00 },
    Orientation: { Promotion: 0.08, Prevention: -0.02 },
    Interest: { Social: 0.06, Enterprising: 0.05, Artistic: 0.01, Investigative: 0.00, Realistic: 0.00, Conventional: 0.00 },
    Fit: { Trust: 0.04, Collaboration: 0.05, PsychSafety: 0.03, Flexibility: 0.02 },
  },
  Outlaw: {
    Trait: { Openness: 0.10, Extraversion: 0.03, Conscientiousness: -0.05, Agreeableness: -0.03, Neuroticism: 0.02 },
    Value: { Autonomy: 0.07, Stimulation: 0.06, Universalism: 0.03, Achievement: 0.02, Security: -0.04, Power: 0.00 },
    Motivation: { Autonomy: 0.08, Competence: 0.04, Relatedness: -0.02, Safety: -0.05 },
    Orientation: { Promotion: 0.07, Prevention: -0.03 },
    Interest: { Artistic: 0.06, Investigative: 0.05, Enterprising: 0.00, Social: 0.00, Realistic: 0.00, Conventional: -0.01 },
    Fit: { Flexibility: 0.05, Trust: 0.02, Collaboration: -0.02, PsychSafety: -0.03 },
  },
  Explorer: {
    Trait: { Openness: 0.10, Extraversion: 0.04, Conscientiousness: -0.02, Agreeableness: 0.01, Neuroticism: -0.01 },
    Value: { Stimulation: 0.07, Autonomy: 0.05, Universalism: 0.02, Achievement: 0.02, Security: -0.03, Power: 0.00 },
    Motivation: { Competence: 0.06, Autonomy: 0.05, Relatedness: 0.01, Safety: -0.02 },
    Orientation: { Promotion: 0.08, Prevention: -0.02 },
    Interest: { Investigative: 0.06, Realistic: 0.04, Enterprising: 0.03, Artistic: 0.00, Social: 0.00, Conventional: -0.01 },
    Fit: { Flexibility: 0.04, Collaboration: 0.03, Trust: 0.02, PsychSafety: 0.00 },
  },
  Creator: {
    Trait: { Openness: 0.11, Neuroticism: 0.02, Conscientiousness: 0.03, Agreeableness: 0.02, Extraversion: 0.02 },
    Value: { Autonomy: 0.06, Stimulation: 0.05, Universalism: 0.04, Achievement: 0.03, Security: -0.02, Power: 0.00 },
    Motivation: { Competence: 0.05, Autonomy: 0.06, Relatedness: 0.02, Safety: -0.01 },
    Orientation: { Promotion: 0.06, Prevention: 0.00 },
    Interest: { Artistic: 0.08, Investigative: 0.04, Enterprising: 0.00, Social: 0.00, Realistic: 0.00, Conventional: -0.01 },
    Fit: { Flexibility: 0.04, Trust: 0.02, PsychSafety: 0.00, Collaboration: 0.02 },
  },
  Sage: {
    Trait: { Conscientiousness: 0.07, Openness: 0.05, Agreeableness: 0.03, Extraversion: -0.01, Neuroticism: -0.04 },
    Value: { Universalism: 0.06, Security: 0.05, Achievement: 0.03, Autonomy: 0.02, Stimulation: -0.04, Power: 0.00 },
    Motivation: { Competence: 0.07, Autonomy: 0.04, Relatedness: 0.03, Safety: 0.02 },
    Orientation: { Promotion: 0.00, Prevention: 0.07 },
    Interest: { Investigative: 0.06, Conventional: 0.03, Enterprising: 0.00, Social: 0.00, Artistic: 0.00, Realistic: 0.00 },
    Fit: { Trust: 0.06, PsychSafety: 0.05, Collaboration: 0.04, Flexibility: 0.02 },
  },
  Magician: {
    Trait: { Openness: 0.10, Conscientiousness: 0.04, Extraversion: 0.03, Agreeableness: 0.02, Neuroticism: -0.03 },
    Value: { Autonomy: 0.06, Stimulation: 0.04, Universalism: 0.04, Achievement: 0.02, Security: 0.00, Power: 0.00 },
    Motivation: { Competence: 0.05, Autonomy: 0.05, Relatedness: 0.03, Safety: 0.00 },
    Orientation: { Promotion: 0.06, Prevention: 0.02 },
    Interest: { Artistic: 0.05, Investigative: 0.05, Enterprising: 0.02, Social: 0.00, Realistic: 0.00, Conventional: 0.00 },
    Fit: { Flexibility: 0.04, Trust: 0.03, Collaboration: 0.03, PsychSafety: 0.02 },
  },
  Caregiver: {
    Trait: { Agreeableness: 0.08, Conscientiousness: 0.06, Extraversion: 0.02, Openness: 0.00, Neuroticism: -0.03 },
    Value: { Universalism: 0.07, Security: 0.05, Autonomy: 0.02, Achievement: 0.01, Stimulation: -0.03, Power: 0.00 },
    Motivation: { Relatedness: 0.08, Competence: 0.05, Autonomy: 0.01, Safety: 0.03 },
    Orientation: { Promotion: 0.01, Prevention: 0.06 },
    Interest: { Social: 0.07, Conventional: 0.04, Enterprising: 0.00, Artistic: 0.00, Investigative: 0.00, Realistic: 0.00 },
    Fit: { Trust: 0.06, Collaboration: 0.06, PsychSafety: 0.05, Flexibility: 0.02 },
  },
  Ruler: {
    Trait: { Conscientiousness: 0.08, Extraversion: 0.05, Agreeableness: 0.03, Openness: 0.02, Neuroticism: -0.04 },
    Value: { Achievement: 0.06, Security: 0.06, Power: 0.05, Autonomy: 0.02, Universalism: 0.00, Stimulation: -0.01 },
    Motivation: { Competence: 0.06, Relatedness: 0.04, Autonomy: 0.03, Safety: 0.03 },
    Orientation: { Promotion: 0.02, Prevention: 0.06 },
    Interest: { Enterprising: 0.06, Conventional: 0.04 },
    Fit: { Trust: 0.06, Collaboration: 0.05, PsychSafety: 0.05, Flexibility: 0.02 },
  },
  Everyman: {
    Trait: { Agreeableness: 0.08, Extraversion: 0.03, Conscientiousness: 0.03, Neuroticism: -0.04, Openness: 0.02 },
    Value: { Universalism: 0.06, Security: 0.05, Autonomy: 0.02, Achievement: 0.01, Stimulation: -0.03, Power: 0.00 },
    Motivation: { Relatedness: 0.07, Safety: 0.04, Competence: 0.03, Autonomy: 0.02 },
    Orientation: { Promotion: 0.02, Prevention: 0.05 },
    Interest: { Social: 0.07, Conventional: 0.03 },
    Fit: { Trust: 0.06, PsychSafety: 0.05, Collaboration: 0.06, Flexibility: 0.03 },
  },
  Jester: {
    Trait: { Extraversion: 0.08, Agreeableness: 0.05, Openness: 0.04, Conscientiousness: -0.01, Neuroticism: -0.03 },
    Value: { Stimulation: 0.06, Universalism: 0.04, Autonomy: 0.03, Achievement: 0.02, Security: -0.03, Power: 0.00 },
    Motivation: { Relatedness: 0.06, Autonomy: 0.04, Competence: 0.03, Safety: -0.02 },
    Orientation: { Promotion: 0.08, Prevention: -0.01 },
    Interest: { Artistic: 0.05, Social: 0.05, Enterprising: 0.03 },
    Fit: { Flexibility: 0.05, Collaboration: 0.04, Trust: 0.03, PsychSafety: 0.02 },
  },
  Lover: {
    Trait: { Agreeableness: 0.08, Extraversion: 0.04, Neuroticism: 0.02, Conscientiousness: 0.03, Openness: 0.01 },
    Value: { Universalism: 0.06, Security: 0.05, Autonomy: 0.02, Achievement: 0.01, Stimulation: -0.03, Power: 0.00 },
    Motivation: { Relatedness: 0.08, Safety: 0.03, Competence: 0.02, Autonomy: 0.02 },
    Orientation: { Promotion: 0.01, Prevention: 0.06 },
    Interest: { Social: 0.07, Artistic: 0.04 },
    Fit: { Trust: 0.06, PsychSafety: 0.06, Collaboration: 0.05, Flexibility: 0.03 },
  },
  Innocent: {
    Trait: { Agreeableness: 0.06, Extraversion: 0.04, Neuroticism: -0.03, Openness: 0.03, Conscientiousness: 0.03 },
    Value: { Security: 0.06, Universalism: 0.05, Autonomy: 0.03, Achievement: 0.01, Stimulation: 0.00, Power: 0.00 },
    Motivation: { Relatedness: 0.06, Safety: 0.04, Autonomy: 0.03, Competence: 0.02 },
    Orientation: { Promotion: 0.04, Prevention: 0.04 },
    Interest: { Social: 0.06, Realistic: 0.04 },
    Fit: { PsychSafety: 0.06, Trust: 0.05, Collaboration: 0.04, Flexibility: 0.03 },
  },
};

/** ユーティリティ */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mean = arr => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const std = arr => {
  const m = mean(arr); const v = mean(arr.map(x => (x - m) ** 2));
  return Math.sqrt(v) || 1e-6;
};

/**
 * 回答配列 → 下位因子スコア（平均値 1..6）
 * @param {Answer[]} answers
 * @returns {Record<string, number>} map: subfactorKey => meanScore(1..6)
 */
export function toSubfactorScores(answers) {
  const meta = new Map(QUESTIONS.map(q => [q.id, q]));
  const buckets = new Map(); // key: axis/subfactor

  for (const ans of answers) {
    const q = meta.get(ans.id);
    if (!q) continue;
    const key = `${q.axis}.${q.subfactor}`;
    const raw = clamp(Number(ans.value) || 0, 1, 6);
    const val = q.reverse ? 7 - raw : raw;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(val);
  }

  const out = {};
  for (const [key, arr] of buckets.entries()) {
    out[key] = mean(arr); // 1..6
  }
  return out;
}

/** 1..6 → 0..1 正規化（個人内Z→0..1） */
export function normalizeSubfactors(subScores) {
  const keys = Object.keys(subScores);
  const vals = keys.map(k => subScores[k]);
  const m = mean(vals);
  const s = std(vals);
  const z = Object.fromEntries(keys.map(k => [k, (subScores[k] - m) / s]));
  // 0..1 に射影（Z in [-3, +3] を想定）
  const norm = Object.fromEntries(keys.map(k => [k, clamp((z[k] + 3) / 6, 0, 1)]));
  return norm;
}

/** ベクトル化（25Dが欠損しても0.5で埋める） */
export function toVector25(normScores) {
  const vec = {};
  for (const [axis, subs] of Object.entries(SUBFACTORS)) {
    for (const sf of subs) {
      const key = `${axis}.${sf}`;
      vec[key] = key in normScores ? normScores[key] : 0.5; // 中央で補完
    }
  }
  return vec; // values in 0..1
}

/** アーキタイプごとのスコア（線形合成） */
export function scoreArchetypes(vec25, weights = ARCHETYPE_WEIGHTS) {
  const scores = {};
  for (const [type, w] of Object.entries(weights)) {
    let s = 0;
    for (const [axis, subs] of Object.entries(w)) {
      for (const [sf, coeff] of Object.entries(subs)) {
        const key = `${axis}.${sf}`;
        const x = vec25[key] ?? 0.5;
        s += coeff * x;
      }
    }
    scores[type] = s;
  }
  return scores; // 実数（未正規化）
}

/** ソフトマックス（温度tauで調整） */
export function softmax(scores, tau = 1.0) {
  const types = Object.keys(scores);
  const vals = types.map(t => scores[t] / tau);
  const maxv = Math.max(...vals);
  const exps = vals.map(v => Math.exp(v - maxv));
  const Z = exps.reduce((a, b) => a + b, 0) || 1e-6;
  const probs = Object.fromEntries(types.map((t, i) => [t, exps[i] / Z]));
  return probs;
}

/** 最終判定 */
export function decide(vec25, weights = ARCHETYPE_WEIGHTS) {
  const raw = scoreArchetypes(vec25, weights);
  const prob = softmax(raw, 0.9); // 少し鋭く
  const ranked = Object.entries(prob).sort((a, b) => b[1] - a[1]);
  const [t1, p1] = ranked[0];
  const [t2, p2] = ranked[1];
  const confidence = p1;
  const delta = p1 - p2;
  const balanceIndex = 1 - delta; // 0→単相／1→二相
  return {
    prob,
    ranked,
    type_main: t1,
    type_sub: delta <= 0.05 ? t2 : null,
    confidence,
    delta,
    balanceIndex,
    rawScore: raw,
  };
}

/** フルパイプライン：回答 → 判定 */
export function diagnose(answers, opts = {}) {
  const sub = toSubfactorScores(answers);
  const norm = normalizeSubfactors(sub);
  const vec = toVector25(norm);
  const dec = decide(vec, opts.weights || ARCHETYPE_WEIGHTS);
  return { sub, norm, vec, ...dec };
}

/** 簡易バリデーション（平均同意傾向など） */
export function quickQC(answers) {
  const vals = answers.map(a => clamp(Number(a.value) || 0, 1, 6));
  return {
    n: vals.length,
    mean: mean(vals),
    std: std(vals),
    skew: (() => { const m = mean(vals); const s = std(vals); return mean(vals.map(v => ((v - m) / s) ** 3)); })(),
  };
}

export default {
  SUBFACTORS,
  ARCHETYPE_WEIGHTS,
  toSubfactorScores,
  normalizeSubfactors,
  toVector25,
  scoreArchetypes,
  softmax,
  decide,
  diagnose,
  quickQC,
};
