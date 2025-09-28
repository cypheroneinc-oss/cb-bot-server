import rawQuestions from '../../data/questions.v1.js';

export const DATASET_VERSION = 2;

function normalizeChoice(choice) {
  const description = choice.desc ?? choice.description ?? '';
  return Object.freeze({
    key: choice.key,
    label: choice.label,
    description: description || undefined,
    tags: choice.tags ?? {},
    weight: typeof choice.w === 'number' ? choice.w : 1,
  });
}

function normalizeQuestion(question, index) {
  const code = question.id;
  const normalizedChoices = Object.freeze((question.choices ?? []).map(normalizeChoice));
  return Object.freeze({
    code,
    id: code,
    text: question.text,
    order: question.sort_order ?? index + 1,
    choices: normalizedChoices,
  });
}

const INTERNAL_QUESTIONS = rawQuestions.map(normalizeQuestion);
const QUESTION_MAP = new Map(INTERNAL_QUESTIONS.map((question) => [question.code, question]));

const PUBLIC_QUESTIONS = INTERNAL_QUESTIONS.map((question) =>
  Object.freeze({
    code: question.code,
    text: question.text,
    choices: Object.freeze(
      question.choices.map((choice) =>
        Object.freeze({
          key: choice.key,
          label: choice.label,
          description: choice.description,
        })
      )
    ),
  })
);

function assertVersion(version) {
  if (version !== DATASET_VERSION) {
    throw new Error('Unsupported question set version');
  }
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
  return INTERNAL_QUESTIONS.map((question) => question.code);
}
