import crypto from 'node:crypto';
import {
  DATASET_VERSION,
  getQuestionByCode,
  getQuestionDataset,
  listQuestionCodes,
} from './questions/index.js';

const QUESTION_VERSION = DATASET_VERSION;
const QUESTION_IDS = listQuestionCodes(QUESTION_VERSION);

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

/* ───────── 追加：12アーキタイプ用定義 ───────── */
const ARCHETYPES = [
  'hero','outlaw','explorer','creator','sage','magician',
  'caregiver','ruler','everyman','jester','lover','innocent'
];

/** 
 * 各設問→アーキタイプ割当と極性
 * POS/NEG は mapLikertToChoice で決まる choiceKey と突き合わせる
 * weight は回答に付与される w（0.25〜0.75）をそのまま用いる
 *
 * 方針：
 * - 12タイプ×2問ずつ（24問）をカバー
 * - 反対極性は －w で集計し、両極のバイアスを打ち消し
 */
const QUESTION_TO_ARCH = {
  // Hero（主体性・達成志向）
  Q01: [{ type: 'hero', polarity: 'NEG' }], // 中心にならない=POS → Heroとは逆極
  Q02: [{ type: 'hero', polarity: 'NEG' }], // 失敗を軽く流す=POS → Heroとは逆極

  // Outlaw（反体制・自律）
  Q04: [{ type: 'outlaw', polarity: 'POS' }],
  Q16: [{ type: 'outlaw', polarity: 'POS' }],

  // Explorer（自律・自由・未知志向）
  Q05: [{ type: 'explorer', polarity: 'NEG' }], // 慣れ優先=POS → Explorerとは逆極
  Q17: [{ type: 'explorer', polarity: 'POS' }],

  // Creator（創造・表現）
  Q07: [{ type: 'creator', polarity: 'POS' }],
  Q20: [{ type: 'creator', polarity: 'POS' }],

  // Sage（真理・分析）
  Q09: [{ type: 'sage', polarity: 'NEG' }],   // “そういうもの”受容=POS → 探究欲とは逆極
  Q10: [{ type: 'sage', polarity: 'NEG' }],   // 直感優先=POS → 根拠重視とは逆極

  // Magician（変容・ビジョン駆動）
  Q12: [{ type: 'magician', polarity: 'NEG' }], // 安定志向=POS → 変化志向とは逆極
  Q23: [{ type: 'magician', polarity: 'NEG' }], // 現実優先=POS → 理想/変容先導とは逆極

  // Caregiver（支援・配慮）
  Q13: [{ type: 'caregiver', polarity: 'POS' }],
  Q14: [{ type: 'caregiver', polarity: 'POS' }],

  // Ruler（秩序・統率）
  Q03: [{ type: 'ruler', polarity: 'POS' }],  // 既存理解→構造志向
  Q15: [{ type: 'ruler', polarity: 'NEG' }],  // サポート志向=POS → リードとは逆極

  // Everyman（共感・同質性・受容）
  Q08: [{ type: 'everyman', polarity: 'POS' }],
  Q22: [{ type: 'everyman', polarity: 'POS' }],

  // Jester（楽しさ・退屈拒否）
  Q06: [{ type: 'jester', polarity: 'NEG' }], // ルーチン好き=POS → Jesterとは逆極
  Q19: [{ type: 'jester', polarity: 'NEG' }], // 沈黙OK=POS → 場の高揚とは逆極

  // Lover（絆・情熱）
  Q18: [{ type: 'lover', polarity: 'NEG' }],  // 合わせない=POS → 調和志向とは逆極
  Q21: [{ type: 'lover', polarity: 'NEG' }],  // 自分の為だけに頑張れる=POS → 関係駆動とは逆極

  // Innocent（信頼・善性・受容）
  Q24: [{ type: 'innocent', polarity: 'POS' }],
  // Q06は両極を持たせる（Innocentは反対に「繰り返しの安心」を好む）
  // すでに Jester: NEG を与えているため、Innocent 側は POS を与える
  // 重複割当を明示的に許可（同一設問で対立タイプのベクトルを分離）
  Q06_extra_innocent: [{ type: 'innocent', polarity: 'POS', questionId: 'Q06' }],
};

/* ───────── ここまで追加定義 ───────── */

export function aggregateAnswers(answers, { expectedQuestionCount = 30 } = {}) {
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
    ClusterHints: {},
    // 追加：アーキタイプ生配列（計算は別関数で）
  };

  for (const answer of answers) {
    const { questionId, choiceKey, w: answerWeight } = answer ?? {};
    if (typeof questionId !== 'string' || typeof choiceKey !== 'string') {
      throw new Error('Each answer must contain questionId and choiceKey');
    }
    if (seenQuestions.has(questionId)) {
      throw new Error(`Duplicate answer for question ${questionId}`);
    }
    if (!QUESTION_IDS.includes(questionId)) {
      throw new Error(`Unknown question id: ${questionId}`);
    }

    const question = getQuestionByCode(questionId);
    let choice = question.choices.find((c) => c.key === choiceKey);
    if (!choice) {
      throw new Error(`Unknown choice ${choiceKey} for question ${questionId}`);
    }
    if (typeof answerWeight === 'number' && Number.isFinite(answerWeight)) {
      choice = { ...choice, w: answerWeight };
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
  if (total <= 0) return 0;
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

/* Safety：Q13, Q17, Q19 */
function computeSafetyScore(selection) {
  const relevant = selection.filter(({ question }) => ['Q13', 'Q17', 'Q19'].includes(question.id));
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

/* Workstyle：Q03, Q10, Q11, Q16 */
function computeWorkstyleScore(selection) {
  const relevant = selection.filter(({ question }) => ['Q03', 'Q10', 'Q11', 'Q16'].includes(question.id));
  let raw = 0;
  let max = 0;
  for (const { question, choice } of relevant) {
    const val = sumTagWeights(choice.tags?.WorkStyle ?? [], WORKSTYLE_WEIGHTS) * (choice.w ?? 1);
    raw += val;

    const maxChoice = Math.max(
      ...question.choices.map((c) =>
        sumTagWeights(c.tags?.WorkStyle ?? [], WORKSTYLE_WEIGHTS) * (c.w ?? 1)
      )
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
  if (unique === 0) return 5;
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

/* ───────── 追加：アーキタイプスコア計算 ───────── */
function computeArchetypeScores(selection) {
  const scores = Object.fromEntries(ARCHETYPES.map((t) => [t, 0]));
  for (const { question, choice } of selection) {
    const qid = question.id;
    const weight = choice.w ?? 1;
    const mappings = [
      ...(QUESTION_TO_ARCH[qid] ?? []),
      // Q06 の Innocent用の追加割当
      ...(qid === (QUESTION_TO_ARCH.Q06_extra_innocent?.[0]?.questionId || '') ? QUESTION_TO_ARCH.Q06_extra_innocent : [])
    ];
    if (mappings.length === 0) continue;

    for (const m of mappings) {
      const sign = choice.key === m.polarity ? +1 : -1;
      scores[m.type] += sign * weight;
    }
  }
  // 正規化（-∞〜∞ → 0〜100 ではなく相対比較用に z 風スケール）
  // ここでは最小限：負値も許容し、そのまま返す（上位比較は絶対値ではなく値で判定）
  const order = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = order[0]?.[0] ?? null;
  return { scores, primary };
}
/* ───────── 追加ここまで ───────── */

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

  // 追加：アーキタイプ
  const { scores: archetypeScores, primary: primaryArchetype } = computeArchetypeScores(selection);

  return {
    mbti,
    safety,
    workstyle,
    motivation,
    ng,
    sync,
    total,
    archetypeScores,
    primaryArchetype
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
  if (contenders.length === 1) return top[0];

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
    if (next.size === 1) return [...next][0];
    remaining = next;
  }
  return [...remaining][0];
}

function motivationFocus(cluster) {
  switch (cluster) {
    case 'challenge': return 'achieve';
    case 'creative':  return 'growth';
    case 'support':   return 'contribution';
    case 'strategy':  return 'security';
    default:          return 'achieve';
  }
}

function clusterSync(counts, cluster) {
  switch (cluster) {
    case 'challenge': return (counts.Sync?.high_tension ?? 0) + (counts.Sync?.tsukkomi ?? 0);
    case 'creative':  return (counts.Sync?.quiet_hot ?? 0) + (counts.Sync?.natural ?? 0);
    case 'support':   return (counts.Sync?.relaxed ?? 0) + (counts.Sync?.natural ?? 0);
    case 'strategy':  return counts.Sync?.logical_cool ?? 0;
    default:          return 0;
  }
}

function clusterWorkstyle(counts, cluster) {
  switch (cluster) {
    case 'challenge': return (counts.WorkStyle?.speed ?? 0) + (counts.WorkStyle?.improv ?? 0);
    case 'creative':  return (counts.WorkStyle?.intuitive ?? 0) + (counts.WorkStyle?.improv ?? 0);
    case 'support':   return counts.WorkStyle?.careful ?? 0;
    case 'strategy':  return (counts.WorkStyle?.structured ?? 0) + (counts.WorkStyle?.logical ?? 0);
    default:          return 0;
  }
}

function clusterMbti(counts, cluster) {
  switch (cluster) {
    case 'challenge': return (counts.MBTI?.E ?? 0) + (counts.MBTI?.P ?? 0);
    case 'creative':  return counts.MBTI?.N ?? 0;
    case 'support':   return counts.MBTI?.I ?? 0;
    case 'strategy':  return (counts.MBTI?.I ?? 0) + (counts.MBTI?.T ?? 0) + (counts.MBTI?.J ?? 0);
    default:          return 0;
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
  if (alternatives.length === 0) throw new Error('No alternatives provided');
  if (alternatives.length === 1) return alternatives[0];
  const hash = crypto.createHash('sha256').update(sessionId).digest();
  const seed = hash.readUInt32BE(0);
  const random = xorShift32(seed);
  const index = Math.floor(random() * alternatives.length);
  return alternatives[index];
}

const HERO_RULES = {
  challenge: [
    { slug: 'oda', predicate: ({ counts }) =>
      (counts.WorkStyle?.speed ?? 0) >= 2 &&
      (counts.Motivation?.achieve ?? 0) >= 2 &&
      (counts.Sync?.high_tension ?? 0) >= 2 },
    { slug: 'napoleon', predicate: ({ counts }) =>
      (counts.Motivation?.achieve ?? 0) >= 2 &&
      (counts.WorkStyle?.structured ?? 0) >= 1 },
    { slug: 'ryoma', predicate: ({ counts }) =>
      (counts.Motivation?.autonomy ?? 0) >= 2 &&
      (counts.MBTI?.N ?? 0) >= 2 },
    { slug: 'galileo', predicate: ({ counts }) => (counts.MBTI?.T ?? 0) >= 2 }
  ],
  creative: [
    { slug: 'picasso', predicate: ({ counts }) => (counts.WorkStyle?.improv ?? 0) >= 4 },
    { slug: 'beethoven', predicate: ({ counts }) =>
      (counts.Sync?.quiet_hot ?? 0) >= 1 && (counts.Sync?.relaxed ?? 0) >= 1 },
    { slug: 'murasaki', predicate: ({ counts }) =>
      (counts.WorkStyle?.careful ?? 0) >= 2 && (counts.Motivation?.curiosity ?? 0) >= 2 },
    { slug: 'davinci', predicate: ({ counts }) =>
      (counts.WorkStyle?.intuitive ?? 0) >= 2 && (counts.Motivation?.growth ?? 0) >= 2 }
  ],
  support: [
    { slug: 'mother_teresa', predicate: ({ counts }) => (counts.Motivation?.connection ?? 0) >= 3 },
    { slug: 'shibusawa', predicate: ({ counts }) => (counts.Motivation?.growth ?? 0) >= 2 && (counts.WorkStyle?.structured ?? 0) >= 1 },
    { slug: 'rikyu', predicate: ({ counts }) =>
      (counts.Sync?.relaxed ?? 0) >= 2 || (counts.Motivation?.security ?? 0) >= 2 },
    { slug: 'nightingale', predicate: ({ counts }) =>
      (counts.WorkStyle?.careful ?? 0) >= 2 && (counts.Motivation?.contribution ?? 0) >= 2 }
  ],
  strategy: [
    { slug: 'shotoku', predicate: ({ counts }) =>
      (counts.Motivation?.contribution ?? 0) >= 1 && (counts.Sync?.natural ?? 0) >= 1 },
    { slug: 'date', predicate: ({ counts }) => (counts.Motivation?.autonomy ?? 0) >= 2 },
    { slug: 'einstein', predicate: ({ counts }) =>
      (counts.Motivation?.curiosity ?? 0) >= 2 && (counts.WorkStyle?.logical ?? 0) >= 2 },
    { slug: 'ieyasu', predicate: ({ counts }) =>
      (counts.Motivation?.security ?? 0) >= 2 && (counts.WorkStyle?.structured ?? 0) >= 2 }
  ]
};

function decideHero(cluster, counts, sessionId) {
  const rules = HERO_RULES[cluster] ?? [];
  for (const rule of rules) {
    if (rule.predicate({ counts, cluster })) return rule.slug;
  }
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

export function scoreAndMapToHero(
  answers,
  questionDataset = getQuestionDataset(QUESTION_VERSION)
) {
  const questionMap = new Map(questionDataset.map((question) => [question.id, question]));

  const normalized = answers.map((answer) => {
    const questionId = answer?.questionId ?? answer?.question_id;
    const choiceKey = answer?.choiceKey ?? answer?.choice_key;
    const weightRaw = answer?.w ?? answer?.weight;
    const weight = typeof weightRaw === 'number' && Number.isFinite(weightRaw)
      ? weightRaw
      : undefined;

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

    return weight === undefined ? { questionId, choiceKey } : { questionId, choiceKey, w: weight };
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
  // 追加でエクスポート（必要に応じて）
  ARCHETYPES as ARCHETYPE_KEYS
};
