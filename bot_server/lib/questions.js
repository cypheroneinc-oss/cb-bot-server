import questions from '../data/questions.v1.json' assert { type: 'json' };

export function getQuestions(version = 1) {
  if (version !== 1) {
    throw new Error('Unsupported question set version');
  }
  return questions;
}

export function getQuestionById(id) {
  return getQuestions().find((q) => q.id === id);
}
