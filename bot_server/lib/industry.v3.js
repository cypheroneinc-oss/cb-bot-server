// filename: bot_server/lib/industry.v3.js
// v3 scorer 用：業界24 × 9軸 {H,E,X,A,C,O,speech,emotion,action} の係数マップ
// 値は 0..1 想定（初期値：合理的な仮ベクトル。後日ABで調整可）

export const INDUSTRY_WEIGHTS = Object.freeze({
  entrepreneurship: { H:0.55, E:0.50, X:0.75, A:0.45, C:0.55, O:0.75, speech:0.75, emotion:0.55, action:0.85 },
  education:        { H:0.70, E:0.65, X:0.50, A:0.85, C:0.65, O:0.55, speech:0.70, emotion:0.75, action:0.45 },
  healthcare:       { H:0.80, E:0.75, X:0.45, A:0.80, C:0.70, O:0.50, speech:0.60, emotion:0.85, action:0.45 },
  art_design:       { H:0.50, E:0.55, X:0.55, A:0.55, C:0.45, O:0.90, speech:0.55, emotion:0.80, action:0.55 },
  entertainment:    { H:0.50, E:0.55, X:0.80, A:0.55, C:0.45, O:0.70, speech:0.80, emotion:0.75, action:0.60 },
  science:          { H:0.65, E:0.50, X:0.40, A:0.55, C:0.80, O:0.75, speech:0.70, emotion:0.45, action:0.45 },
  business_sales:   { H:0.55, E:0.55, X:0.75, A:0.60, C:0.55, O:0.55, speech:0.85, emotion:0.60, action:0.60 },
  planning:         { H:0.60, E:0.55, X:0.55, A:0.60, C:0.70, O:0.70, speech:0.80, emotion:0.55, action:0.55 },
  public:           { H:0.75, E:0.60, X:0.45, A:0.75, C:0.80, O:0.45, speech:0.65, emotion:0.55, action:0.40 },
  finance:          { H:0.70, E:0.55, X:0.45, A:0.60, C:0.85, O:0.50, speech:0.70, emotion:0.45, action:0.45 },
  it_tech:          { H:0.60, E:0.50, X:0.50, A:0.55, C:0.70, O:0.80, speech:0.70, emotion:0.50, action:0.55 },
  engineering:      { H:0.65, E:0.55, X:0.45, A:0.60, C:0.85, O:0.55, speech:0.65, emotion:0.45, action:0.55 },
  pr_comms:         { H:0.55, E:0.55, X:0.80, A:0.65, C:0.50, O:0.60, speech:0.90, emotion:0.65, action:0.55 },
  agro_env:         { H:0.70, E:0.65, X:0.45, A:0.70, C:0.65, O:0.60, speech:0.55, emotion:0.65, action:0.55 },
  hospitality:      { H:0.60, E:0.65, X:0.60, A:0.80, C:0.55, O:0.50, speech:0.65, emotion:0.80, action:0.55 },
  sports:           { H:0.55, E:0.55, X:0.80, A:0.55, C:0.55, O:0.55, speech:0.60, emotion:0.60, action:0.85 },
  legal:            { H:0.75, E:0.55, X:0.50, A:0.60, C:0.80, O:0.55, speech:0.80, emotion:0.45, action:0.45 },
  writing:          { H:0.60, E:0.55, X:0.45, A:0.60, C:0.60, O:0.75, speech:0.70, emotion:0.60, action:0.50 },
  spiritual:        { H:0.65, E:0.75, X:0.45, A:0.75, C:0.50, O:0.60, speech:0.55, emotion:0.85, action:0.45 },
  fashion_beauty:   { H:0.55, E:0.55, X:0.70, A:0.60, C:0.50, O:0.65, speech:0.65, emotion:0.70, action:0.55 },
  game_video:       { H:0.55, E:0.50, X:0.55, A:0.55, C:0.65, O:0.75, speech:0.70, emotion:0.55, action:0.65 },
  global:           { H:0.60, E:0.55, X:0.65, A:0.60, C:0.60, O:0.70, speech:0.75, emotion:0.60, action:0.65 },
  food_service:     { H:0.60, E:0.60, X:0.60, A:0.70, C:0.60, O:0.50, speech:0.60, emotion:0.70, action:0.60 },
  social_startup:   { H:0.65, E:0.60, X:0.70, A:0.65, C:0.55, O:0.70, speech:0.75, emotion:0.65, action:0.75 },
});

export default INDUSTRY_WEIGHTS;