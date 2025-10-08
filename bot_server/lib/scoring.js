// lib/scoring.js
// Cロジック診断・判定ユーティリティ v1（外部重み参照版）
// 依存: /data/questions.v1.js, /lib/archetype-weights.v1.json

import QUESTIONS from "../data/questions.v1.js";
import WEIGHTS from "./archetype-weights.v1.json" assert { type: "json" };

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

/** ユーティリティ */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const std = (arr) => {
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v) || 1e-6;
};

/**
 * 回答配列 → 下位因子スコア（平均値 1..6）
 * @param {Answer[]} answers
 * @returns {Record<string, number>} map: subfactorKey => meanScore(1..6)
 */
export function toSubfactorScores(answers) {
  const meta = new Map(QUESTIONS.map((q) => [q.id, q]));
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
  const vals = keys.map((k) => subScores[k]);
  const m = mean(vals);
  const s = std(vals);
  const z = Object.fromEntries(keys.map((k) => [k, (subScores[k] - m) / s]));
  // 0..1 に射影（Z in [-3, +3] を想定）
  const norm = Object.fromEntries(keys.map((k) => [k, clamp((z[k] + 3) / 6, 0, 1)]));
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
export function scoreArchetypes(vec25, weights = WEIGHTS) {
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
  const vals = types.map((t) => scores[t] / tau);
  const maxv = Math.max(...vals);
  const exps = vals.map((v) => Math.exp(v - maxv));
  const Z = exps.reduce((a, b) => a + b, 0) || 1e-6;
  const probs = Object.fromEntries(types.map((t, i) => [t, exps[i] / Z]));
  return probs;
}

/** 最終判定 */
export function decide(vec25, weights = WEIGHTS) {
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
  const weights = opts.weights || WEIGHTS;
  const dec = decide(vec, weights);
  return { sub, norm, vec, ...dec };
}

/** 簡易バリデーション（平均同意傾向など） */
export function quickQC(answers) {
  const vals = answers.map((a) => clamp(Number(a.value) || 0, 1, 6));
  return {
    n: vals.length,
    mean: mean(vals),
    std: std(vals),
    skew: (() => {
      const m = mean(vals);
      const s = std(vals);
      return mean(vals.map((v) => ((v - m) / s) ** 3));
    })(),
  };
}

export default {
  SUBFACTORS,
  toSubfactorScores,
  normalizeSubfactors,
  toVector25,
  scoreArchetypes,
  softmax,
  decide,
  diagnose,
  quickQC,
};
