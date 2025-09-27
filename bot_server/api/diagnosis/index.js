import { createClient } from '@supabase/supabase-js';
import questionsDataset from '../../data/questions.v1.js';
import { QUESTION_VERSION } from '../../lib/scoring.js';

export const config = { runtime: 'nodejs' }; // なぜ: Edge では Supabase SDK が動作しないため

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`ENV ${name} is missing`);
  return value;
}

function normalizeQuestion(row) {
  if (!row) {
    throw new Error('Question row is empty');
  }

  const questionId = row.code ?? row.question_id ?? row.id;
  if (!questionId) {
    throw new Error('Question code is missing');
  }

  return {
    question_id: questionId,
    sort_order: row.sort_order ?? row.order ?? null,
    text: row.text ?? '',
    choices: row.choices ?? [],
  };
}

const EXPECTED_COUNT = questionsDataset.length;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'));

    const { data, error } = await supabase
      .from('questions')
      .select('code, text, choices, sort_order')
      .order('sort_order', { ascending: true })
      .limit(EXPECTED_COUNT);

    if (error) {
      console.error('[diagnosis] supabase error', error); // なぜ: 失敗要因をログで即把握するため
      return res
        .status(500)
        .json({ error: error.message, code: error.code || 'SUPABASE_ERROR' });
    }

    if (!data) {
      console.error('[diagnosis] no data returned from questions table');
      return res.status(500).json({ error: 'No questions available', code: 'NO_DATA' });
    }

    const normalized = data.map(normalizeQuestion);

    const missingSortOrder = normalized.filter((q) => typeof q.sort_order !== 'number');
    if (missingSortOrder.length > 0) {
      console.error('[diagnosis] sort_order missing', {
        questionIds: missingSortOrder.map((q) => q.question_id),
      }); // なぜ: 並び順の破綻に即気付けるようにする
      return res.status(500).json({
        error: 'sort_order missing in questions dataset',
        code: 'MISSING_SORT_ORDER',
      });
    }

    if (normalized.length !== EXPECTED_COUNT) {
      console.error('[diagnosis] invalid question count', {
        expected: EXPECTED_COUNT,
        actual: normalized.length,
      }); // なぜ: 件数不整合が起きた際に即調査できるようにする
      return res.status(500).json({
        error: `Expected ${EXPECTED_COUNT} questions, got ${normalized.length}`,
        code: 'INVALID_COUNT',
      });
    }

    const mismatched = normalized.filter((q, index) => q.question_id !== questionsDataset[index]?.id);
    if (mismatched.length > 0) {
      console.error('[diagnosis] dataset mismatch detected', {
        mismatched: mismatched.map((q) => q.question_id),
      }); // なぜ: DB とコードの不整合を即把握するため
      return res.status(500).json({
        error: 'Question dataset mismatch detected',
        code: 'DATASET_MISMATCH',
      });
    }

    return res.status(200).json({
      version: QUESTION_VERSION,
      count: normalized.length,
      questions: normalized,
    });
  } catch (error) {
    console.error('[diagnosis] fatal', error); // なぜ: 想定外例外の痕跡を残すため
    return res.status(500).json({ error: error?.message || String(error), code: 'FATAL' });
  }
}
