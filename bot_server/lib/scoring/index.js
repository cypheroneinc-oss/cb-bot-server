import { scoreAndMapToHero, runDiagnosis, QUESTION_VERSION } from '../scoring.js';
import { getQuestionDataset } from '../questions/index.js';

export { QUESTION_VERSION, scoreAndMapToHero, runDiagnosis };

const SIX_POINT_MAPPING = new Map([
  [1, { choiceKey: 'POS', w: 0.75 }],
  [2, { choiceKey: 'POS', w: 0.5 }],
  [3, { choiceKey: 'POS', w: 0.25 }],
  [4, { choiceKey: 'NEG', w: 0.25 }],
  [5, { choiceKey: 'NEG', w: 0.5 }],
  [6, { choiceKey: 'NEG', w: 0.75 }]
]);

const SEVEN_POINT_MAPPING = new Map([
  [1, { choiceKey: 'NEG', w: 0.75 }],
  [2, { choiceKey: 'NEG', w: 0.5 }],
  [3, { choiceKey: 'NEG', w: 0.25 }],
  [5, { choiceKey: 'POS', w: 0.25 }],
  [6, { choiceKey: 'POS', w: 0.5 }],
  [7, { choiceKey: 'POS', w: 0.75 }]
]);

export function mapLikertToChoice({ questionId, scale, scaleMax, maxScale }) {
  const resolvedQuestionId =
    questionId ?? undefined;
  const rawScale = scale ?? undefined;
  const numericScale = Number(rawScale);

  if (!resolvedQuestionId || !Number.isFinite(numericScale)) {
    return null;
  }

  const intScale = Math.trunc(numericScale);
  const resolvedMax = maxScale ?? scaleMax;
  const numericMax = Number(resolvedMax);
  const usesSevenPoint = Number.isFinite(numericMax) && numericMax === 7;

  if (!usesSevenPoint && SIX_POINT_MAPPING.has(intScale)) {
    const mapped = SIX_POINT_MAPPING.get(intScale);
    return { questionId: resolvedQuestionId, choiceKey: mapped.choiceKey, w: mapped.w };
  }

  if (!Number.isInteger(intScale) || intScale < 1 || intScale > 7) {
    return null;
  }

  const mapped = SEVEN_POINT_MAPPING.get(intScale);
  if (!mapped) {
    return { questionId: resolvedQuestionId, choiceKey: 'POS', w: 0 };
  }

  return { questionId: resolvedQuestionId, choiceKey: mapped.choiceKey, w: mapped.w };
}

export function score(answers, version = QUESTION_VERSION) {
  if (version !== QUESTION_VERSION) {
    throw new Error('Unsupported question set version');
  }

  const normalized = Array.isArray(answers)
    ? answers.map((answer) => ({
        questionId:
          answer?.questionId ?? answer?.question_id ?? answer?.code ?? answer?.id,
        choiceKey: answer?.choiceKey ?? answer?.choice_key ?? answer?.key,
        scale: answer?.scale ?? answer?.value,
        scaleMax:
          answer?.scaleMax ??
          answer?.maxScale ??
          answer?.scale_range ??
          answer?.scaleRange,
        weight: answer?.w ?? answer?.weight
      }))
        .map(({ questionId, choiceKey, scale, scaleMax, weight }) => {
          let resolvedChoiceKey = choiceKey;
          let resolvedWeight = typeof weight === 'number' ? weight : undefined;

          if (!resolvedChoiceKey && scale !== undefined && scale !== null) {
            const mapped = mapLikertToChoice({ questionId, scale, scaleMax });
            if (!mapped) {
              return null;
            }
            resolvedChoiceKey = mapped.choiceKey;
            resolvedWeight = mapped.w;
          }

          if (!questionId || !resolvedChoiceKey) {
            return null;
          }

          return typeof resolvedWeight === 'number'
            ? { questionId, choiceKey: resolvedChoiceKey, w: resolvedWeight }
            : { questionId, choiceKey: resolvedChoiceKey };
        })
        .filter(Boolean)
    : [];

  return scoreAndMapToHero(normalized, getQuestionDataset(version));
}
