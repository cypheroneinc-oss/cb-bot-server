// filename: bot_server/api/diagnosis/index.js
// Minimal-diff: 既存のレスポンス形は維持しつつ、v3(30問)を選択可能に。
// - ?v=3 / ?version=v3 などで v3 セットを返す
// - 未指定は既存（v1相当）にフォールバック

import { getQuestions } from '../../lib/questions/index.js';
import { QUESTION_VERSION } from '../../lib/scoring/index.js';

export const config = { runtime: 'nodejs' };

function firstValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function resolveVersion(req) {
  const raw =
    firstValue(req.query?.v) ??
    firstValue(req.query?.version) ??
    firstValue(req.query?.ver) ??
    firstValue(req.query?.question_version);

  if (raw == null || raw === '') return String(QUESTION_VERSION).toLowerCase();
  const v = String(raw).toLowerCase();
  if (v === '3' || v === 'v3') return '3';           // v3 明示
  return String(QUESTION_VERSION).toLowerCase();     // 既存に寄せる
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const version = resolveVersion(req);
    const questions = getQuestions(version);
    return res
      .status(200)
      .json({ version, count: questions.length, questions });
  } catch (error) {
    console.error('[diagnosis] fatal', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}