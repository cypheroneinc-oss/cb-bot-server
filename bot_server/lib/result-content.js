const CLUSTER_LABELS = {
  challenge: 'チャレンジ',
  creative: 'クリエイティブ',
  support: 'サポート',
  strategy: 'ストラテジー',
};

const HERO_METADATA = {
  oda: { name: '織田信長タイプ', cluster: 'challenge', avatar: 'oda.png' },
  napoleon: { name: 'ナポレオンタイプ', cluster: 'challenge', avatar: 'napoleon.png' },
  ryoma: { name: '坂本龍馬タイプ', cluster: 'challenge', avatar: 'ryoma.png' },
  galileo: { name: 'ガリレオ・ガリレイタイプ', cluster: 'challenge', avatar: 'galileo.png' },
  picasso: { name: 'ピカソタイプ', cluster: 'creative', avatar: 'picasso.png' },
  beethoven: { name: 'ベートーヴェンタイプ', cluster: 'creative', avatar: 'beethoven.png' },
  murasaki: { name: '紫式部タイプ', cluster: 'creative', avatar: 'murasaki.png' },
  davinci: { name: 'レオナルド・ダ・ヴィンチタイプ', cluster: 'creative', avatar: 'davinci.png' },
  mother_teresa: { name: 'マザー・テレサタイプ', cluster: 'support', avatar: 'mother_teresa.png' },
  shibusawa: { name: '渋沢栄一タイプ', cluster: 'support', avatar: 'shibusawa.png' },
  rikyu: { name: '千利休タイプ', cluster: 'support', avatar: 'rikyu.png' },
  nightingale: { name: 'ナイチンゲールタイプ', cluster: 'support', avatar: 'nightingale.png' },
  shotoku: { name: '聖徳太子タイプ', cluster: 'strategy', avatar: 'shotoku.png' },
  date: { name: '伊達政宗タイプ', cluster: 'strategy', avatar: 'date.png' },
  einstein: { name: 'アインシュタインタイプ', cluster: 'strategy', avatar: 'einstein.png' },
  ieyasu: { name: '徳川家康タイプ', cluster: 'strategy', avatar: 'ieyasu.png' },
};

const CLUSTER_CONTENT = {
  challenge: {
    summary1line: '直感と行動で空気を切り開くフロントランナー。',
    strengths: ['初動が速い', '人前での牽引力', '未知にワクワクできる'],
    misfit_env: ['細かい手順の厳守だけを重視する現場', '自由度が極端に低い体制'],
    how_to_use: ['最初の火付け役を任せる', '0→1の検証タスクで先頭に置く', '議論の場で推進役を任命する'],
    next_action: ['今週、誰も手を出していない小タスクを自分発で提案→着手'],
  },
  creative: {
    summary1line: 'ひらめきと探究心で新しい景色を描くアイデアメーカー。',
    strengths: ['直感的な発想力', '試行錯誤を楽しむ粘り強さ', '感性で周囲を刺激する力'],
    misfit_env: ['正解が一つに決められた単調な仕事', '自由な試作が許されない環境'],
    how_to_use: ['ブレストや企画立ち上げの起爆剤にする', '試作品づくりや表現タスクを任せる', '学びのアウトプットを共有してもらう'],
    next_action: ['気になるアイデアを一つスケッチに起こしてチームに共有する'],
  },
  support: {
    summary1line: '共感と気配りで安心感をつくるチームの調律者。',
    strengths: ['相手の変化に気づく観察眼', '困りごとを拾う聞き役力', '裏側から支える段取り力'],
    misfit_env: ['競争だけを煽る評価制度', '個人プレーを強いるワンマン体制'],
    how_to_use: ['チームのハブ役やフォロー役を任せる', '新人や後輩のオンボーディングを任せる', '声を拾うファシリ役で活かす'],
    next_action: ['最近様子が気になるメンバーに声をかけ、短い対話時間をつくる'],
  },
  strategy: {
    summary1line: '俯瞰とロジックで道筋を描く現場の設計士。',
    strengths: ['物事を整理する構造化力', 'リスクを見抜く観察力', '安定運用を支える継続力'],
    misfit_env: ['計画を無視した場当たり的運営', '情報が曖昧なまま突き進むプロジェクト'],
    how_to_use: ['業務の標準化やルール整備を任せる', '判断材料を集めるリサーチ役にする', '中長期計画の進行管理を依頼する'],
    next_action: ['直近のタスクを棚卸しし、優先順位と手順を1枚にまとめて共有する'],
  },
};

function trimTrailingSlash(value) {
  return value ? value.replace(/\/$/, '') : '';
}

function buildAvatarUrl(slug, avatar) {
  if (!slug) {
    return null;
  }
  const explicit = avatar ?? '';
  if (explicit.startsWith('http://') || explicit.startsWith('https://')) {
    return explicit;
  }
  const base = trimTrailingSlash(
    process.env.HERO_CDN_BASE_URL ?? process.env.CDN_BASE_URL ?? ''
  );
  if (base) {
    const path = explicit ? explicit.replace(/^\//, '') : `${slug}.png`;
    return `${base}/heroes/${path}`;
  }
  const label = encodeURIComponent(slug);
  return `https://placehold.co/512x512?text=${label}`;
}

export function getClusterLabel(cluster) {
  return CLUSTER_LABELS[cluster] ?? cluster ?? '';
}

export function getHeroProfile(slug) {
  const meta = HERO_METADATA[slug] ?? {
    name: `${slug ?? '不明'}タイプ`,
    cluster: 'challenge',
    avatar: `${slug ?? 'unknown'}.png`,
  };
  return {
    slug,
    name: meta.name,
    cluster: meta.cluster,
    avatarUrl: buildAvatarUrl(slug, meta.avatar),
  };
}

export function getClusterNarrative(cluster) {
  return CLUSTER_CONTENT[cluster] ?? {
    summary1line: '',
    strengths: [],
    misfit_env: [],
    how_to_use: [],
    next_action: [],
  };
}
