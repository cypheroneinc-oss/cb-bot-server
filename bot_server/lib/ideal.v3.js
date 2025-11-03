// filename: bot_server/lib/ideal.v3.js
// v3 scorer 用：12理想タイプ × 9軸 {H,E,X,A,C,O,speech,emotion,action} の係数マップ
// 値は 0..1 想定（初期値：合理的な仮ベクトル。後日ABで調整可）

export const IDEAL_WEIGHTS = Object.freeze({
  leader:     { H:0.65, E:0.55, X:0.70, A:0.50, C:0.70, O:0.50, speech:0.75, emotion:0.45, action:0.65 },
  liberator:  { H:0.45, E:0.50, X:0.65, A:0.45, C:0.40, O:0.85, speech:0.55, emotion:0.55, action:0.75 },
  supporter:  { H:0.70, E:0.65, X:0.45, A:0.85, C:0.55, O:0.45, speech:0.50, emotion:0.85, action:0.45 },
  scholar:    { H:0.65, E:0.50, X:0.35, A:0.55, C:0.80, O:0.70, speech:0.75, emotion:0.45, action:0.40 },
  artist:     { H:0.45, E:0.55, X:0.55, A:0.55, C:0.40, O:0.90, speech:0.45, emotion:0.80, action:0.55 },
  guardian:   { H:0.80, E:0.65, X:0.40, A:0.75, C:0.75, O:0.45, speech:0.55, emotion:0.70, action:0.45 },
  challenger: { H:0.45, E:0.50, X:0.75, A:0.45, C:0.50, O:0.65, speech:0.50, emotion:0.55, action:0.85 },
  connector:  { H:0.55, E:0.55, X:0.75, A:0.80, C:0.50, O:0.55, speech:0.85, emotion:0.70, action:0.55 },
  charisma:   { H:0.50, E:0.55, X:0.85, A:0.55, C:0.45, O:0.60, speech:0.90, emotion:0.75, action:0.60 },
  builder:    { H:0.60, E:0.50, X:0.40, A:0.55, C:0.85, O:0.55, speech:0.75, emotion:0.45, action:0.55 },
  reformer:   { H:0.80, E:0.55, X:0.55, A:0.55, C:0.65, O:0.75, speech:0.75, emotion:0.55, action:0.60 },
  healer:     { H:0.65, E:0.80, X:0.45, A:0.80, C:0.55, O:0.55, speech:0.55, emotion:0.90, action:0.45 },
});

export default IDEAL_WEIGHTS;