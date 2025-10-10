// filename: bot_server/lib/scoring/index.js
// 最小修正版: named import をやめて安全に取り出す。
// ロジック・マッピングは一切変更しない。

import * as scoringModule from '../scoring.js';          // ← ここを一本化
import { getQuestionDataset } from '../questions/index.js';

// QUESTION_VERSION を安全に取得（無ければ 'v1'）
export const QUESTION_VERSION = scoringModule.QUESTION_VERSION || 'v1';

// 必要なシンボルだけ “存在すれば” エクスポート
export const scoreAndMapToHero = scoringModule.scoreAndMapToHero;
export const runDiagnosis      = scoringModule.runDiagnosis; // 無ければ undefined のままでOK

const SIX_POINT_MAPPING = new Map([
  [1, { choiceKey: 'POS', w: 0.75 }],
  [2, { choiceKey: 'POS', w: 0.5 }],
  [3, { choiceKey: 'POS', w: 0.25 }],
  [4, { choiceKey: 'NEG', w: 0.25 }],
  [5, { choiceKey: 'NEG', w: 0.5 }],
  [6, { choiceKey: 'NEG', w: 0.75 }],
]);

const SEVEN_POINT_MAPPING = new Map([
  [1, { choiceKey: 'NEG', w: 0.75 }],
  [2, { choiceKey: 'NEG', w: 0.5 }],
  [3, { choiceKey: 'NEG', w: 0.25 }],
  [5, { choiceKey: 'POS', w: 0.25 }],
  [6, { choiceKey: 'POS', w: 0.5 }],
  [7, { choiceKey: 'POS', w: 0.75 }],
]);

export function mapLikertToChoice({ questionId, scale, scaleMax, maxScale }) {
  const resolvedQuestionId = questionId ?? undefined;
  const numericScale = Number(scale ?? undefined);
  if (!resolvedQuestionId || !Number.isFinite(numericScale)) return null;

  const intScale = Math.trunc(numericScale);
  const numericMax = Number(maxScale ?? scaleMax);
  const usesSevenPoint = Number.isFinite(numericMax) && numericMax === 7;

  if (!usesSevenPoint && SIX_POINT_MAPPING.has(intScale)) {
    const m = SIX_POINT_MAPPING.get(intScale);
    return { questionId: resolvedQuestionId, choiceKey: m.choiceKey, w: m.w };
  }
  if (!Number.isInteger(intScale) || intScale < 1 || intScale > 7) return null;

  const m = SEVEN_POINT_MAPPING.get(intScale);
  if (!m) return { questionId: resolvedQuestionId, choiceKey: 'POS', w: 0 };
  return { questionId: resolvedQuestionId, choiceKey: m.choiceKey, w: m.w };
}

export function score(answers, version = QUESTION_VERSION) {
  if (version !== QUESTION_VERSION) {
    throw new Error('Unsupported question set version');
  }

  const normalized = Array.isArray(answers)
    ? answers
        .map((a) => ({
          questionId: a?.questionId ?? a?.question_id ?? a?.code ?? a?.id,
          choiceKey: a?.choiceKey ?? a?.choice_key ?? a?.key,
          scale: a?.scale ?? a?.value,
          scaleMax: a?.scaleMax ?? a?.maxScale ?? a?.scale_range ?? a?.scaleRange,
          weight: a?.w ?? a?.weight,
        }))
        .map(({ questionId, choiceKey, scale, scaleMax, weight }) => {
          let key = choiceKey;
          let w = typeof weight === 'number' ? weight : undefined;

          if (!key && scale != null) {
            const mapped = mapLikertToChoice({ questionId, scale, scaleMax });
            if (!mapped) return null;
            key = mapped.choiceKey;
            w = mapped.w;
          }
          if (!questionId || !key) return null;

          return typeof w === 'number'
            ? { questionId, choiceKey: key, w }
            : { questionId, choiceKey: key };
        })
        .filter(Boolean)
    : [];

  return scoreAndMapToHero(normalized, getQuestionDataset(version));
}
