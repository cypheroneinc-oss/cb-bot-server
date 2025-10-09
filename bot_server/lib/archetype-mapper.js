// bot_server/lib/archetype-mapper.js
// 入力: 新ロジックの出力（例：C-Logic 7層のスコアやファセット）
// 出力: 12タイプのキー 'hero' | 'outlaw' | ... | 'innocent'
const TYPE_KEYS = [
  'hero','outlaw','explorer','creator','sage','magician',
  'caregiver','ruler','everyman','jester','lover','innocent'
];

// 例: ウェイト付き線形結合 → 最大値のタイプを返す（ダミー。実ロジックで置換）
export function mapToArchetype(cLogicScores) {
  // cLogicScores: { trait:{...}, motive:{...}, emotion:{...}, will:{...}, ethics:{...}, meaning:{...}, behavior:{...} など
  // 実ロジック：重み付け／しきい値／ルールベースをここに集約
  const scoreByType = {
    hero:      f(cLogicScores, { will: +0.8, behavior: +0.6, motive: +0.3 }),
    outlaw:    f(cLogicScores, { ethics: -0.5, will: +0.7, meaning: +0.2 }),
    explorer:  f(cLogicScores, { trait_open: +0.8, motive: +0.5, behavior: +0.4 }),
    creator:   f(cLogicScores, { trait_open: +0.7, emotion: +0.3, meaning: +0.5 }),
    sage:      f(cLogicScores, { trait_intellect: +0.8, ethics: +0.2 }),
    magician:  f(cLogicScores, { intuition: +0.7, systems: +0.4 }),
    caregiver: f(cLogicScores, { agreeableness: +0.7, compassion: +0.6 }),
    ruler:     f(cLogicScores, { conscientiousness: +0.8, structure: +0.5 }),
    everyman:  f(cLogicScores, { belonging: +0.7, harmony: +0.4 }),
    jester:    f(cLogicScores, { playfulness: +0.8, mood_lift: +0.4 }),
    lover:     f(cLogicScores, { attachment: +0.7, empathy: +0.5 }),
    innocent:  f(cLogicScores, { hope: +0.7, optimism: +0.5 }),
  };
  return Object.entries(scoreByType).sort((a,b)=>b[1]-a[1])[0][0];
}

function f(scores, weights) {
  let s = 0;
  for (const [k,w] of Object.entries(weights)) s += (scores[k] ?? 0) * w;
  return s;
}

export { TYPE_KEYS };
