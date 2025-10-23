// filename: bot_server/lib/scoring/index.js
// 最小差分: 既存ロジックを保持しつつ v3(30問) の直通スコアリングを追加。
// - 既存の scoreAndMapToHero/runDiagnosis には一切手を触れない
// - v3 は answers を { Qxx: 1..6 } に正規化して ./v3.js へ委譲

import * as scoringModule from '../scoring.js';
import { getQuestionDataset } from '../questions/index.js';
import scoreDiagnosisV3 from './v3.js'; // ← 追加（v3専用スコアラー）

// 既存の公開定数を温存（互換維持）
export const QUESTION_VERSION = scoringModule.QUESTION_VERSION || 'v1';

// 既存シンボルをそのまま再エクスポート（無ければ undefined のまま）
export const scoreAndMapToHero = scoringModule.scoreAndMapToHero;
export const runDiagnosis      = scoringModule.runDiagnosis;

// 6点/7点Likert → 旧スコアラー用のPOS/NEGマップ（既存踏襲）
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
  const v = String(version ?? QUESTION_VERSION).toLowerCase();

  // --- v3: 新ロジックに直通（既存を触らない） ---
  if (v === '3' || v === 'v3') {
    // answers を { Qxx: 1..6 } へ最小正規化
    let dict = {};
    if (Array.isArray(answers)) {
      for (const a of answers) {
        const id =
          a?.questionId ?? a?.question_id ?? a?.code ?? a?.id;
        const val =
          a?.scale ?? a?.value ?? a?.answer ?? a?.val;
        const n = Number(val);
        if (id && Number.isFinite(n)) {
          dict[id] = n;
        }
      }
    } else if (answers && typeof answers === 'object') {
      // 既に辞書形式なら、そのまま数値だけ拾う
      for (const k of Object.keys(answers)) {
        const n = Number(answers[k]);
        if (Number.isFinite(n)) dict[k] = n;
      }
    }
    return scoreDiagnosisV3(dict, { version: '3' });
  }

  // --- 既存系: 従来の厳格チェックを維持 ---
  if (version !== QUESTION_VERSION) {
    throw new Error('Unsupported question set version');
  }

  // 既存スコアリング: Likert→POS/NEG へマップして scoreAndMapToHero に委譲
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