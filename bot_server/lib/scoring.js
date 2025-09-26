import crypto from 'node:crypto';
import { getQuestions, getQuestionById } from './questions.js';

const QUESTION_VERSION = 1;
const QUESTION_IDS = getQuestions(QUESTION_VERSION).map((q) => q.id);

const SAFETY_MATRIX = new Map([
  ['high:high', 12],
  ['high:mid', 11],
  ['high:low', 9],
  ['mid:high', 10],
  ['mid:mid', 9],
  ['mid:low', 8],
  ['low:high', 7],
  ['low:mid', 6],
  ['low:low', 8]
]);

const WORKSTYLE_WEIGHTS = {
  speed: 4,
  improv: 3,
  structured: 4,
  logical: 3,
  careful: 3,
  intuitive: 3
};

const MOTIVATION_ORDER = [
  'achieve',
  'approval',
  'contribution',
  'security',
  'curiosity',
  'autonomy',
  'connection',
  'growth'
];

const SYNC_CATEGORIES = [
  'high_tension',
  'natural',
  'quiet_hot',
  'logical_cool',
  'relaxed',
  'tsukkomi'
];

const NG_CATEGORIES = [
  'pressure',
  'instant_reply',
  'read_between_lines',
  'monotony',
  'no_autonomy',
  'no_change'
];

const CLUSTERS = ['challenge', 'creative', 'support', 'strategy'];

export function aggregateAnswers(answers, { expectedQuestionCount = 25 } = {}) {
  if (!Array.isArray(answers)) {
    throw new Error('Answers must be an array');
  }

  if (answers.length !== expectedQuestionCount) {
    throw new Error(`Exactly ${expectedQuestionCount} answers are required`);
  }

  const seenQuestions = new Set();
  const selection = [];
  const counts = {
    MBTI: {},
    WorkStyle: {},
    Motivation: {},
    NG: {},
    Sync: {},
    BigFive: { agreeableness: {}, extraversion: {} },
    ClusterHints: {}
  };

  for (const answer of answers) {
    const { questionId, choiceKey } = answer ?? {};
    if (typeof questionId !== 'string' || typeof choiceKey !== 'string') {
      throw new Error('Each answer must contain questionId and choiceKey');
    }

    if (seenQuestions.has(questionId)) {
      throw new Error(`Duplicate answer for question ${questionId}`);
    }

    if (!QUESTION_IDS.includes(questionId)) {
      throw new Error(`Unknown question id: ${questionId}`);
    }

    const question = getQuestionById(questionId);
    const choice = question.choices.find((c) => c.key === choiceKey);
    if (!choice) {
      throw new Error(`Unknown choice ${choiceKey} for question ${questionId}`);
    }

    seenQuestions.add(questionId);
    selection.push({ question, choice });

    const { tags = {}, w = 1 } = choice;

    if (tags.MBTI) {
      for (const t of tags.MBTI) {
        counts.MBTI[t] = (counts.MBTI[t] ?? 0) + w;
      }
    }

    if (tags.WorkStyle) {
      for (const t of tags.WorkStyle) {
        counts.WorkStyle[t] = (counts.WorkStyle[t] ?? 0) + w;
      }
    }

    if (tags.Motivation) {
      for (const t of tags.Motivation) {
        counts.Motivation[t] = (counts.Motivation[t] ?? 0) + w;
      }
    }

    if (tags.NG) {
      for (const t of tags.NG) {
        counts.NG[t] = (counts.NG[t] ?? 0) + w;
      }
    }

    if (tags.Sync) {
      for (const t of tags.Sync) {
        counts.Sync[t] = (counts.Sync[t] ?? 0) + w;
      }
    }

    if (tags.BigFive) {
      const { agreeableness, extraversion } = tags.BigFive;
      if (agreeableness) {
        counts.BigFive.agreeableness[agreeableness] =
          (counts.BigFive.agreeableness[agreeableness] ?? 0) + w;
      }
      if (extraversion) {
        counts.BigFive.extraversion[extraversion] =
          (counts.BigFive.extraversion[extraversion] ?? 0) + w;
      }
    }

    if (tags.CLUSTER_HINT) {
      for (const t of tags.CLUSTER_HINT) {
        counts.ClusterHints[t] = (counts.ClusterHints[t] ?? 0) + w;
      }
    }
  }

  if (seenQuestions.size !== expectedQuestionCount) {
    throw new Error('Missing answers for one or more questions');
  }

  return { selection, counts };
}

function balanceScore(positive, negative, weight) {
  const total = positive + negative;
  if (total <= 0) {
    return 0;
  }
  const diff = Math.abs(positive - negative);
  const balance = 1 - diff / total;
  return weight * balance;
}

function computeMbtiScore(counts) {
  const dimensions = [
    { positive: 'N', negative: 'T', weight: 10 },
    { positive: 'J', negative: 'P', weight: 5 },
    { positive: 'E', negative: 'I', weight: 5 }
  ];
  const score = dimensions.reduce((acc, dim) => {
    const pos = counts[dim.positive] ?? 0;
    const neg = counts[dim.negative] ?? 0;
    return acc + balanceScore(pos, neg, dim.weight);
  }, 0);
  return Math.round(score);
}

function computeSafetyScore(selection) {
  const relevant = selection.filter(({ question }) => ['Q5', 'Q6', 'Q7'].includes(question.id));
  let raw = 0;
  let max = 0;

  for (const { question, choice } of relevant) {
    const { tags = {}, w = 1 } = choice;
    const bigFive = tags.BigFive ?? {};
    const key = `${bigFive.agreeableness ?? 'mid'}:${bigFive.extraversion ?? 'mid'}`;
    raw += (SAFETY_MATRIX.get(key) ?? 8) * w;

    const maxForQuestion = Math.max(
      ...question.choices.map((c) => {
        const bf = c.tags?.BigFive ?? {};
        const k = `${bf.agreeableness ?? 'mid'}:${bf.extraversion ?? 'mid'}`;
        return (SAFETY_MATRIX.get(k) ?? 8) * (c.w ?? 1);
      })
    );
    max += maxForQuestion;
  }

  if (max === 0) return 0;
  return Math.round((raw / max) * 20);
}

function computeWorkstyleScore(selection) {
  const relevant = selection.filter(({ question }) => ['Q8', 'Q9', 'Q10', 'Q11'].includes(question.id));
  let raw = 0;
  let max = 0;
  for (const { question, choice } of relevant) {
    const val = sumTagWeights(choice.tags?.WorkStyle ?? [], WORKSTYLE_WEIGHTS) * (choice.w ?? 1);
    raw += val;

    const maxChoice = Math.max(
      ...question.choices.map((c) => sumTagWeights(c.tags?.WorkStyle ?? [], WORKSTYLE_WEIGHTS) * (c.w ?? 1))
    );
    max += maxChoice;
  }
  if (max === 0) return 0;
  return Math.round((raw / max) * 15);
}

function sumTagWeights(tags, weightMap) {
  return tags.reduce((acc, t) => acc + (weightMap[t] ?? 0), 0);
}

function computeMotivationScore(counts) {
  const totals = MOTIVATION_ORDER.map((key) => counts[key] ?? 0);
  const sorted = [...totals].sort((a, b) => b - a);
  const top = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  const third = sorted[2] ?? 0;
  const topScore = (top / 4) * 15;
  const secondScore = (second / 4) * 6;
  const thirdScore = (third / 4) * 3;
  const total = Math.min(15, topScore + secondScore + thirdScore);
  return Math.round(total);
}

function computeNgScore(counts) {
  const unique = NG_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0).length;
  const intensity = NG_CATEGORIES.reduce((acc, key) => acc + (counts[key] ?? 0), 0);
  if (unique === 0) return 5; // 基本的なリスク感度
  const uniquenessScore = (unique / NG_CATEGORIES.length) * 10;
  const intensityScore = Math.min(5, intensity);
  return Math.round(uniquenessScore + intensityScore);
}

function computeSyncScore(counts) {
  const totals = SYNC_CATEGORIES.map((key) => counts[key] ?? 0);
  const maxCount = Math.max(...totals, 0);
  if (maxCount === 0) return 5;
  const diversity = totals.filter((v) => v > 0).length;
  const primary = (maxCount / 4) * 10;
  const diversityScore = Math.min(5, (diversity / SYNC_CATEGORIES.length) * 5);
  return Math.round(Math.min(15, primary + diversityScore));
}

export function computeFactorScores(answers, precomputed) {
  const { selection, counts } =
    precomputed ?? aggregateAnswers(answers);
  const mbti = computeMbtiScore(counts.MBTI);
  const safety = computeSafetyScore(selection);
  const workstyle = computeWorkstyleScore(selection);
  const motivation = computeMotivationScore(counts.Motivation);
  const ng = computeNgScore(counts.NG);
  const sync = computeSyncScore(counts.Sync);

  const total = Math.min(100, mbti + safety + workstyle + motivation + ng + sync);

  return {
    mbti,
    safety,
    workstyle,
    motivation,
    ng,
    sync,
    total
  };
}

function safeRatio(a, b) {
  if (b === 0) return 0;
  return a / b;
}

function clusterBaseScores(counts) {
  const { MBTI, WorkStyle, Motivation, NG, Sync, ClusterHints } = counts;

  const challenge =
    (MBTI.E ?? 0) +
    (MBTI.N ?? 0) +
    (MBTI.P ?? 0) +
    (WorkStyle.speed ?? 0) +
    (WorkStyle.improv ?? 0) +
    (Motivation.achieve ?? 0) +
    (Motivation.autonomy ?? 0) +
    (Sync.high_tension ?? 0) +
    (Sync.tsukkomi ?? 0) +
    (ClusterHints.challenge ?? 0);

  const creative =
    (MBTI.N ?? 0) +
    (WorkStyle.intuitive ?? 0) +
    (WorkStyle.improv ?? 0) +
    (Motivation.curiosity ?? 0) +
    (Motivation.growth ?? 0) +
    (Sync.quiet_hot ?? 0) +
    (Sync.natural ?? 0) +
    (ClusterHints.creative ?? 0);

  const support =
    (Motivation.contribution ?? 0) +
    (Motivation.connection ?? 0) +
    (NG.pressure ?? 0) +
    (NG.no_autonomy ?? 0) +
    (Sync.relaxed ?? 0) +
    (Sync.natural ?? 0) +
    (WorkStyle.careful ?? 0) +
    (ClusterHints.support ?? 0);

  const strategy =
    (MBTI.I ?? 0) +
    (MBTI.T ?? 0) +
    (MBTI.J ?? 0) +
    (WorkStyle.structured ?? 0) +
    (WorkStyle.logical ?? 0) +
    (Motivation.security ?? 0) +
    (Sync.logical_cool ?? 0) +
    (ClusterHints.strategy ?? 0);

  return { challenge, creative, support, strategy };
}

function selectCluster(scores, counts) {
  const order = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = order[0];
  const contenders = order.filter(([_, score]) => Math.abs(score - top[1]) <= 2);
  if (contenders.length === 1) {
    return top[0];
  }

  const tieBreakers = [
    (cluster) => safeRatio(counts.Motivation?.[motivationFocus(cluster)] ?? 0, 4),
    (cluster) => safeRatio(clusterSync(counts, cluster), 4),
    (cluster) => safeRatio(clusterWorkstyle(counts, cluster), 4),
    (cluster) => safeRatio(clusterMbti(counts, cluster), 4)
  ];

  let remaining = new Set(contenders.map(([key]) => key));
  for (const scorer of tieBreakers) {
    let bestScore = -Infinity;
    let next = new Set();
    for (const key of remaining) {
      const score = scorer(key);
      if (score > bestScore) {
        bestScore = score;
        next = new Set([key]);
      } else if (score === bestScore) {
        next.add(key);
      }
    }
    if (next.size === 1) {
      return [...next][0];
    }
    remaining = next;
  }

  return [...remaining][0];
}

function motivationFocus(cluster) {
  switch (cluster) {
    case 'challenge':
      return 'achieve';
    case 'creative':
      return 'growth';
    case 'support':
      return 'contribution';
    case 'strategy':
      return 'security';
    default:
      return 'achieve';
  }
}

function clusterSync(counts, cluster) {
  switch (cluster) {
    case 'challenge':
      return (counts.Sync?.high_tension ?? 0) + (counts.Sync?.tsukkomi ?? 0);
    case 'creative':
      return (counts.Sync?.quiet_hot ?? 0) + (counts.Sync?.natural ?? 0);
    case 'support':
      return (counts.Sync?.relaxed ?? 0) + (counts.Sync?.natural ?? 0);
    case 'strategy':
      return counts.Sync?.logical_cool ?? 0;
    default:
      return 0;
  }
}

function clusterWorkstyle(counts, cluster) {
  switch (cluster) {
    case 'challenge':
      return (counts.WorkStyle?.speed ?? 0) + (counts.WorkStyle?.improv ?? 0);
    case 'creative':
      return (counts.WorkStyle?.intuitive ?? 0) + (counts.WorkStyle?.improv ?? 0);
    case 'support':
      return counts.WorkStyle?.careful ?? 0;
    case 'strategy':
      return (counts.WorkStyle?.structured ?? 0) + (counts.WorkStyle?.logical ?? 0);
    default:
      return 0;
  }
}

function clusterMbti(counts, cluster) {
  switch (cluster) {
    case 'challenge':
      return (counts.MBTI?.E ?? 0) + (counts.MBTI?.P ?? 0);
    case 'creative':
      return counts.MBTI?.N ?? 0;
    case 'support':
      return counts.MBTI?.I ?? 0;
    case 'strategy':
      return (counts.MBTI?.I ?? 0) + (counts.MBTI?.T ?? 0) + (counts.MBTI?.J ?? 0);
    default:
      return 0;
  }
}

function xorShift32(seed) {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function pickStable(alternatives, sessionId) {
  if (alternatives.length === 0) {
    throw new Error('No alternatives provided');
  }
  if (alternatives.length === 1) {
    return alternatives[0];
  }
  const hash = crypto.createHash('sha256').update(sessionId).digest();
  const seed = hash.readUInt32BE(0);
  const random = xorShift32(seed);
  const index = Math.floor(random() * alternatives.length);
  return alternatives[index];
}

const HERO_RULES = {
  challenge: [
    {
      slug: 'oda',
      predicate: ({ counts }) =>
        (counts.WorkStyle?.speed ?? 0) >= 2 &&
        (counts.Motivation?.achieve ?? 0) >= 2 &&
        (counts.Sync?.high_tension ?? 0) >= 2
    },
    {
      slug: 'napoleon',
      predicate: ({ counts }) =>
        (counts.Motivation?.achieve ?? 0) >= 2 &&
        (counts.WorkStyle?.structured ?? 0) >= 1
    },
    {
      slug: 'ryoma',
      predicate: ({ counts }) =>
        (counts.Motivation?.autonomy ?? 0) >= 2 &&
        (counts.MBTI?.N ?? 0) >= 2
    },
    {
      slug: 'galileo',
      predicate: ({ counts }) => (counts.MBTI?.T ?? 0) >= 2 }
  ],
  creative: [
    {
      slug: 'picasso',
      predicate: ({ counts }) => (counts.WorkStyle?.improv ?? 0) >= 4
    },
    {
      slug: 'beethoven',
      predicate: ({ counts }) =>
        (counts.Sync?.quiet_hot ?? 0) >= 1 && (counts.Sync?.relaxed ?? 0) >= 1
    },
    {
      slug: 'murasaki',
      predicate: ({ counts }) =>
        (counts.WorkStyle?.careful ?? 0) >= 2 && (counts.Motivation?.curiosity ?? 0) >= 2
    },
    {
      slug: 'davinci',
      predicate: ({ counts }) =>
        (counts.WorkStyle?.intuitive ?? 0) >= 2 && (counts.Motivation?.growth ?? 0) >= 2
    }
  ],
  support: [
    {
      slug: 'mother_teresa',
      predicate: ({ counts }) => (counts.Motivation?.connection ?? 0) >= 3
    },
    {
      slug: 'shibusawa',
      predicate: ({ counts }) => (counts.Motivation?.growth ?? 0) >= 2 && (counts.WorkStyle?.structured ?? 0) >= 1
    },
    {
      slug: 'rikyu',
      predicate: ({ counts }) =>
        (counts.Sync?.relaxed ?? 0) >= 2 || (counts.Motivation?.security ?? 0) >= 2
    },
    {
      slug: 'nightingale',
      predicate: ({ counts }) =>
        (counts.WorkStyle?.careful ?? 0) >= 2 && (counts.Motivation?.contribution ?? 0) >= 2
    }
  ],
  strategy: [
    {
      slug: 'shotoku',
      predicate: ({ counts }) =>
        (counts.Motivation?.contribution ?? 0) >= 1 && (counts.Sync?.natural ?? 0) >= 1
    },
    {
      slug: 'date',
      predicate: ({ counts }) => (counts.Motivation?.autonomy ?? 0) >= 2
    },
    {
      slug: 'einstein',
      predicate: ({ counts }) =>
        (counts.Motivation?.curiosity ?? 0) >= 2 && (counts.WorkStyle?.logical ?? 0) >= 2
    },
    {
      slug: 'ieyasu',
      predicate: ({ counts }) =>
        (counts.Motivation?.security ?? 0) >= 2 && (counts.WorkStyle?.structured ?? 0) >= 2
    }
  ]
};

function decideHero(cluster, counts, sessionId) {
  const rules = HERO_RULES[cluster] ?? [];
  for (const rule of rules) {
    if (rule.predicate({ counts, cluster })) {
      return rule.slug;
    }
  }
  // fallback: stable random among cluster heroes
  const fallbacks = rules.map((rule) => rule.slug);
  return pickStable(fallbacks, sessionId ?? 'default-session');
}

export function runDiagnosis(answers, sessionId) {
  const { selection, counts } = aggregateAnswers(answers);
  const factorScores = computeFactorScores(answers, { selection, counts });
  const baseScores = clusterBaseScores(counts);
  const primaryCluster = selectCluster(baseScores, counts);
  const heroSlug = decideHero(primaryCluster, counts, sessionId);

  return {
    counts,
    selection,
    scores: factorScores,
    clusterScores: baseScores,
    cluster: primaryCluster,
    heroSlug
  };
}

export function scoreAndMapToHero(answers, questionDataset = getQuestions(QUESTION_VERSION)) {
  const questionMap = new Map(questionDataset.map((question) => [question.id, question]));

  const normalized = answers.map((answer) => {
    const questionId = answer?.questionId ?? answer?.question_id;
    const choiceKey = answer?.choiceKey ?? answer?.choice_key;

    if (!questionId || !choiceKey) {
      throw new Error('Invalid answer payload');
    }

    const question = questionMap.get(questionId);
    if (!question) {
      throw new Error(`Unknown question id: ${questionId}`);
    }

    const hasChoice = question.choices.some((choice) => choice.key === choiceKey);
    if (!hasChoice) {
      throw new Error(`Unknown choice ${choiceKey} for ${questionId}`);
    }

    return { questionId, choiceKey };
  });

  const diagnosis = runDiagnosis(normalized);

  return {
    factorScores: diagnosis.scores,
    total: diagnosis.scores.total,
    cluster: diagnosis.cluster,
    heroSlug: diagnosis.heroSlug
  };
}

export {
  QUESTION_VERSION,
  QUESTION_IDS,
  CLUSTERS,
  HERO_RULES,
  pickStable,
  clusterBaseScores,
  selectCluster,
  computeMbtiScore,
  computeSafetyScore,
  computeWorkstyleScore,
  computeMotivationScore,
  computeNgScore,
  computeSyncScore,
  decideHero
};
