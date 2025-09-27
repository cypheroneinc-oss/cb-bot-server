import { getQuestions } from '../../lib/questions/index.js';
import { QUESTION_VERSION } from '../../lib/scoring/index.js';

export const config = { runtime: 'nodejs' };

function firstValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseVersion(req) {
  const raw =
    firstValue(req.query?.v) ??
    firstValue(req.query?.version) ??
    firstValue(req.query?.ver) ??
    firstValue(req.query?.question_version);

  if (raw === undefined || raw === null || raw === '') {
    return QUESTION_VERSION;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : NaN;
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const version = parseVersion(req);
    if (!Number.isInteger(version)) {
      return res.status(400).json({ error: 'Invalid version' });
    }
    if (version !== QUESTION_VERSION) {
      return res.status(400).json({ error: 'Unsupported question set version' });
    }

    const questions = getQuestions(version);
    return res.status(200).json({ version, count: questions.length, questions });
  } catch (error) {
    console.error('[diagnosis] fatal', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
