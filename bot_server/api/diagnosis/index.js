import { getQuestions } from '../../lib/questions.js';
import { QUESTION_VERSION } from '../../lib/scoring.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { v } = req.query ?? {};
  const version = Number(v ?? QUESTION_VERSION);

  if (!Number.isInteger(version) || version !== QUESTION_VERSION) {
    res.status(400).json({ error: 'Unsupported question set version' });
    return;
  }

  const questions = getQuestions(version);
  res.status(200).json({ version, questions });
}
