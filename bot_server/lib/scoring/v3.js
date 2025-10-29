// bot_server/lib/scoring/v3.js
// Ver3: 30問 (Likert 1..6) → HEXACO(6)・Balance(3)・Archetype12・Ideal12 Top3・Industry24 Top5

import { getQuestionDataset } from '../questions/index.js';
import archetypeWeights from '../archetype-weights.v3.json' assert { type: 'json' };
import { IDEAL_12 } from '../ideal.v3.js';
import { INDUSTRY_24 } from '../industry.v3.js'

// 表示ラベル
const ARCHETYPE_LABELS = {
  outlaw: 'アウトロー',
  ruler: 'ルーラー',
  creator: 'クリエイター',
  sage: 'セージ',
  lover: 'ラバー',
  innocent: 'イノセント',
  hero: 'ヒーロー',
  caregiver: 'ケアギバー',
  magician: 'マジシャン',
  explorer: 'エクスプローラー',
  everyman: 'エブリマン',
  jester: 'ジェスター',
};

const IDEAL_LABELS = {
  leader: '導く人',
  liberator: '自由を与える人',
  supporter: '支える人',
  scholar: '知恵で導く人',
  artist: '表現する人',
  guardian: '守る人',
  challenger: '挑戦する人',
  connector: '繋げる人',
  charisma: '情熱で動かす人',
  builder: '仕組みを作る人',
  reformer: '社会を変える人',
  healer: '癒す人',
};

const INDUSTRY_LABELS = {
  entrepreneurship: '起業・経営',
  education: '教育・指導',
  healthcare: '医療・福祉',
  art_design: 'アート・デザイン',
  entertainment: 'エンタメ・表現',
  science: '科学・研究',
  business_sales: 'ビジネス・営業',
  planning: '企画・商品開発',
  public: '公務・行政',
  finance: '金融・会計',
  it_tech: 'IT・テクノロジー',
  engineering: 'ものづくり・工学',
  pr_comms: '広報・コミュニケーション',
  agro_env: '農業・自然・環境',
  hospitality: '観光・ホスピタリティ',
  sports: 'スポーツ・身体表現',
  legal: '司法・法律',
  writing: 'ライティング・出版',
  spiritual: '宗教・哲学・スピリチュアル',
  fashion_beauty: 'ファッション・美容',
  game_video: 'ゲーム・映像・制作',
  global: '国際・グローバル',
  food_service: '食・サービス',
  social_startup: 'スタートアップ・社会起業',
};

// 星のしきい値（weights を 0..1 想定の暫定値。分布を見て微調整OK）
const STAR_THRESHOLDS = [60, 75, 85, 92, 97];

// subfactor の正規化（表記ゆれ対策）
function normFactorKey(s) {
  if (!s) return '';
  const raw = String(s).trim();
  const k = raw.toLowerCase();

  // HEXACO（頭文字・フル名どちらも許容）
  if (raw === 'H' || k.startsWith('honesty')) return 'H';
  if (raw === 'E' || k.startsWith('emotional')) return 'E';
  if (raw === 'X' || k.startsWith('extra')) return 'X';
  if (raw === 'A' || k.startsWith('agree')) return 'A';
  if (raw === 'C' || k.startsWith('consc')) return 'C';
  if (raw === 'O' || k.startsWith('open')) return 'O';

  // Balance 3軸
  if (k === 'speech' || k.includes('word') || k === 's') return 'speech';
  if (k === 'emotion' || k === 'm') return 'emotion';
  if (k === 'action' || k === 'act' || k === 'do') return 'action';

  // 既知以外は生で返す（将来拡張）
  return raw;
}

// 1..6 → 0..100（線形）
function toPercent(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null; // 未回答扱い
  if (n < 1 || n > 6) return null;      // 範囲外は未回答扱い
  const p = ((n - 1) / 5) * 100;
  return Math.round(Math.max(0, Math.min(100, p)));
}

// 内積
function dot(vec, weights) {
  let s = 0;
  for (const k in weights) {
    const w = Number(weights[k] ?? 0);   // 0..1 想定（>1でも相対順位は保たれる）
    const v = Number(vec[k] ?? 0);       // 0..100
    s += w * v;
  }
  return s;
}

function topNByScore(items, n) {
  return items.sort((a, b) => b.score - a.score).slice(0, n);
}

export function scoreDiagnosisV3(answers, { version = '3' } = {}) {
  // 1) 設問メタ（subfactor）取得
  const qset = getQuestionDataset(version); // v3 を返す想定（lib/questions の分岐で担保）
  const buckets = {
    H: [], E: [], X: [], A: [], C: [], O: [],
    speech: [], emotion: [], action: [],
  };

  // 2) 回答正規化 → バケット投入（未回答はスキップ）
  for (const q of qset) {
    const id = q.code;
    const sf = normFactorKey(q.subfactor ?? q.factor);
    if (!buckets.hasOwnProperty(sf)) continue;

    const p = toPercent(answers?.[id]);
    if (p === null) continue; // ★ 未回答/範囲外は入れない
    buckets[sf].push(p);
  }

  // 3) 因子平均（バケット空は0）
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

  const hexaco = {
    H: avg(buckets.H),
    E: avg(buckets.E),
    X: avg(buckets.X),
    A: avg(buckets.A),
    C: avg(buckets.C),
    O: avg(buckets.O),
  };

  const balance = {
    speech: avg(buckets.speech),
    emotion: avg(buckets.emotion),
    action: avg(buckets.action),
  };

  // 4) 9軸ベクトル（weights はこのキーに合わせる）
  const vector = { ...hexaco, ...balance };

  // 5) Archetype（12）
  const archetypeScores = Object.keys(archetypeWeights).map((key) => ({
    id: key,
    label: ARCHETYPE_LABELS[key] ?? key,
    score: dot(vector, archetypeWeights[key]),
  }));
  const bestArche = topNByScore(archetypeScores, 1)[0] ?? { id: 'everyman', label: ARCHETYPE_LABELS.everyman, score: 0 };

  // 6) Ideal（12）Top3
  const idealScores = Object.keys(idealWeights).map((key) => ({
    id: key,
    label: IDEAL_LABELS[key] ?? key,
    score: dot(vector, idealWeights[key]),
  }));
  const idealTop3 = topNByScore(idealScores, 3);

  // 7) Industry（24）Top5（星付与＋短評はプレース）
  const industryScores = Object.keys(industryWeights).map((key) => {
    const score = dot(vector, industryWeights[key]);
    let star = 1;
    for (let i = 0; i < STAR_THRESHOLDS.length; i++) {
      if (score >= STAR_THRESHOLDS[i]) star = i + 1;
    }
    return {
      id: key,
      label: INDUSTRY_LABELS[key] ?? key,
      score,
      star,
      blurb: '',
    };
  });
  const industryTop5 = topNByScore(industryScores, 5);

  // 8) 返却（表示向けは整数）
  return {
    version: '3',
    hexaco, // 0..100
    balance, // 0..100
    archetype: {
      key: bestArche.id,
      label: bestArche.label,
      score: Math.round(bestArche.score),
    },
    idealTop3: idealTop3.map((x) => ({ id: x.id, label: x.label, score: Math.round(x.score) })),
    industryTop5: industryTop5.map((x) => ({
      id: x.id, label: x.label, score: Math.round(x.score), star: x.star, blurb: x.blurb,
    })),
    raw: { vector }, // 内積に使った9軸（デバッグ/ABに利用）
  };
}

export default scoreDiagnosisV3;