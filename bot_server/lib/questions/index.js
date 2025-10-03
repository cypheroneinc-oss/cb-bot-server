// Minimal-diff: 既存の公開インターフェイスを維持しつつ、
// 質問セットのバージョン厳格チェックを緩和して新30問にも対応。
// 質問オブジェクトに将来メタが来ても落ちないよう安全に正規化。

import rawQuestions from '../../data/questions.v1.js';

// 既存のまま残す（API側と齟齬を出さないため）
// ただし assertVersion は実質ノップにして柔軟化
export const DATASET_VERSION = 2;

function normalizeChoice(choice) {
  const description = choice?.desc ?? choice?.description ?? '';
  return Object.freeze({
    key: choice?.key,
    label: choice?.label,
    description: description || undefined,
    tags: choice?.tags ?? {},
    weight: typeof choice?.w === 'number' ? choice.w : 1,
  });
}

function normalizeQuestion(question, index) {
  const code = question?.id ?? question?.code ?? `Q${index + 1}`;
  const normalizedChoices = Object.freeze((question?.choices ?? []).map(normalizeChoice));
  // 追加で来ても落ちないパススルー用（UIは使わなくても保持）
  const extra = {};
  if (question?.type) extra.type = question.type;            // 'likert' | 'gate' など
  if (question?.scale) extra.scale = question.scale;          // { min,max, positiveDirection }
  if (question?.tags) extra.tags = question.tags;
  if (question?.meta) extra.meta = question.meta;

  return Object.freeze({
    code,
    id: code,
    text: question?.text ?? '',
    order: question?.sort_order ?? index + 1,
    choices: normalizedChoices,
    ...extra,
  });
}

const INTERNAL_QUESTIONS = (rawQuestions ?? []).map(normalizeQuestion);
const QUESTION_MAP = new Map(INTERNAL_QUESTIONS.map((q) => [q.code, q]));

// 公開用は従来どおり最小限（text/choices）
// 将来 gate 追加時も choices の key/label/description はそのまま出る
const PUBLIC_QUESTIONS = INTERNAL_QUESTIONS.map((q) =>
  Object.freeze({
    code: q.code,
    text: q.text,
    choices: Object.freeze(
      (q.choices ?? []).map((c) =>
        Object.freeze({
          key: c.key,
          label: c.label,
          description: c.description,
        })
      )
    ),
  })
);

// 旧挙動：version !== DATASET_VERSION で例外
// 新挙動：受け取った値は参照のみ。将来の互換性のため例外にしない。
function assertVersion(_version) {
  // no-op for forward-compat to allow updated datasets behind same API.
}

export function getQuestionDataset(version = DATASET_VERSION) {
  assertVersion(version);
  return INTERNAL_QUESTIONS;
}

export function getQuestionByCode(code, version = DATASET_VERSION) {
  assertVersion(version);
  return QUESTION_MAP.get(code);
}

export function getQuestions(version = DATASET_VERSION) {
  assertVersion(version);
  return PUBLIC_QUESTIONS;
}

export function listQuestionCodes(version = DATASET_VERSION) {
  assertVersion(version);
  return INTERNAL_QUESTIONS.map((q) => q.code);
}
