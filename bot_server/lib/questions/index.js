// bot_server/lib/questions/index.js
// Minimal-diff: 既存の公開インターフェイスを維持しつつ、v3(30問)にも対応。
// - 例外を投げない version ハンドリング
// - 将来メタ(axis/subfactor/factor/scale/tags/meta)はパススルー保持
// - v1/v3 の両データセットを正規化して選択返却

import rawQuestionsV1 from '../../data/questions.v1.js';
import rawQuestionsV3 from '../../data/questions.v3.js';

// 既存を壊さないため残す（実質デフォルト値としてのみ使用）
export const DATASET_VERSION = 2;

// ---------- Normalizers ----------
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

  // 将来追加される可能性のあるメタは極力保持（UI側で未使用でも保持しておく）
  const extra = {};
  if (question?.type) extra.type = question.type;                        // 'likert' 等
  if (question?.scale) extra.scale = question.scale;                      // { min,max,positiveDirection }
  if (question?.tags) extra.tags = question.tags;
  if (question?.meta) extra.meta = question.meta;

  // v3 で使う可能性が高いフィールドは個別に保持
  if (question?.axis) extra.axis = question.axis;                         // 'Trait' | 'Value' | ...
  if (question?.subfactor) extra.subfactor = question.subfactor;          // 'Honesty' | 'speech' など
  if (question?.factor) extra.factor = question.factor;                   // 別名で来ても拾う

  return Object.freeze({
    code,
    id: code,
    text: question?.text ?? '',
    order: question?.sort_order ?? index + 1,
    choices: normalizedChoices,
    ...extra,
  });
}

function buildDataset(raw) {
  const internal = Object.freeze((raw ?? []).map(normalizeQuestion));
  const byCode = new Map(internal.map((q) => [q.code, q]));
  const pub = Object.freeze(
    internal.map((q) =>
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
    )
  );
  return { internal, byCode, pub };
}

// v1/v3 両方を事前正規化してレジストリ化
const DS = {
  v1: buildDataset(rawQuestionsV1),
  v3: buildDataset(rawQuestionsV3),
};

// ---------- Version handling (例外を投げない) ----------
function resolveVersion(version) {
  // 受け取り値のゆるい同値化
  const v = String(version ?? DATASET_VERSION).toLowerCase();
  if (v === '3' || v === 'v3') return 'v3';
  // 既定は v1（現行公開版の互換を最優先）
  return 'v1';
}

// 旧挙動: 厳格チェック → 例外
// 新挙動: no-op（互換のため）
function assertVersion(_version) {
  // intentionally no-op
}

// ---------- Public API (既存シグネチャ維持) ----------
export function getQuestionDataset(version = DATASET_VERSION) {
  assertVersion(version);
  const key = resolveVersion(version);
  return DS[key].internal;
}

export function getQuestionByCode(code, version = DATASET_VERSION) {
  assertVersion(version);
  const key = resolveVersion(version);
  return DS[key].byCode.get(code);
}

export function getQuestions(version = DATASET_VERSION) {
  assertVersion(version);
  const key = resolveVersion(version);
  return DS[key].pub;
}

export function listQuestionCodes(version = DATASET_VERSION) {
  assertVersion(version);
  const key = resolveVersion(version);
  return DS[key].internal.map((q) => q.code);
}