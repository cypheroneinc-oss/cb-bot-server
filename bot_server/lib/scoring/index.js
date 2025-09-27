import { scoreAndMapToHero, runDiagnosis, QUESTION_VERSION } from '../scoring.js';
import { getQuestionDataset } from '../questions/index.js';

export { QUESTION_VERSION, scoreAndMapToHero, runDiagnosis };

export function score(answers, version = QUESTION_VERSION) {
  if (version !== QUESTION_VERSION) {
    throw new Error('Unsupported question set version');
  }

  const normalized = Array.isArray(answers)
    ? answers.map((answer) => ({
        questionId:
          answer?.questionId ?? answer?.question_id ?? answer?.code ?? answer?.id,
        choiceKey: answer?.choiceKey ?? answer?.choice_key ?? answer?.key,
      }))
    : [];

  return scoreAndMapToHero(normalized, getQuestionDataset(version));
}
