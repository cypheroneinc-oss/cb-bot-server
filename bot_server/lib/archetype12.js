// bot_server/lib/archetype12.js
// 12 Archetypes 最小実装（質問/採点/結果本文を1ファイル集約）

export const VERSION_A12 = 'archetype12.v1';

export const ARCHETYPE_IDS = [
  'hero','outlaw','explorer','creator','sage','magician',
  'caregiver','ruler','everyman','jester','lover','innocent'
];

export const ARCHETYPE_LABELS = {
  hero:{ ja:'光の勇者', en:'Hero' },
  outlaw:{ ja:'影の反逆者', en:'Outlaw' },
  explorer:{ ja:'星の探検者', en:'Explorer' },
  creator:{ ja:'夢紡ぎの創造者', en:'Creator' },
  sage:{ ja:'叡智の賢者', en:'Sage' },
  magician:{ ja:'時を操る魔導師', en:'Magician' },
  caregiver:{ ja:'慈愛の守護者', en:'Caregiver' },
  ruler:{ ja:'王冠の統治者', en:'Ruler' },
  everyman:{ ja:'絆の共鳴者', en:'Everyman' },
  jester:{ ja:'虹の道化師', en:'Jester' },
  lover:{ ja:'愛結ぶ恋人', en:'Lover' },
  innocent:{ ja:'純真なる探求者', en:'Innocent / Seeker' },
};

// 左=YES（1）→右=NO（6）
const LIKERT6_SCORE = [5,4,3,2,1,0];
const toPts = (v) => LIKERT6_SCORE[v-1];

// ▼ 質問（あなたが提示した文言をそのまま採用）
export const QUESTIONS_A12 = {
  version: VERSION_A12,
  likert: [
    // Hero
    { id:'Q01', archetype:'hero', facet:'desire', text:'クラスや部活でトラブルが起きたら、自分が前に出てまとめたいと思う？' },
    { id:'Q02', archetype:'hero', facet:'fear',   text:'頑張ったのに力を出し切れなかったとき、すごく悔しい？' },
    // Outlaw
    { id:'Q03', archetype:'outlaw', facet:'desire', text:'きっちり決まったやり方より、自分なりのやり方を試したくなる？' },
    { id:'Q04', archetype:'outlaw', facet:'fear',   text:'「言われた通りにやれ」と強く言われると、反発したくなる気持ちが出る？' },
    // Explorer
    { id:'Q05', archetype:'explorer', facet:'desire', text:'初めて行く場所や新しい遊びを見つけると、すぐ試したくなる？' },
    { id:'Q06', archetype:'explorer', facet:'fear',   text:'毎日同じことの繰り返しってつまらないと思う？' },
    // Creator
    { id:'Q07', archetype:'creator', facet:'desire', text:'授業中やノートのすみに、アイデアや絵を描きたくなることある？' },
    { id:'Q08', archetype:'creator', facet:'fear',   text:'自分の作品や意見がみんなと同じだと、がっかりする？' },
    // Sage
    { id:'Q09', archetype:'sage', facet:'desire', text:'わからないことがあると、調べて本当の理由を知りたくなる？' },
    { id:'Q10', archetype:'sage', facet:'fear',   text:'思い込みで動いたり、間違ったことを広めるのは恐い？' },
    // Magician
    { id:'Q11', archetype:'magician', facet:'desire', text:'工夫して、みんなが驚くような変化を起こしたい？' },
    { id:'Q12', archetype:'magician', facet:'fear',   text:'どれだけ頑張っても何も変わらない状況ってイヤ？' },
    // Caregiver
    { id:'Q13', archetype:'caregiver', facet:'desire', text:'友達が落ち込んでたら、放っておけない？' },
    { id:'Q14', archetype:'caregiver', facet:'fear',   text:'助けたいのに何もできない状況ってつらい？' },
    // Ruler
    { id:'Q15', archetype:'ruler', facet:'desire', text:'グループ活動のとき、自然と役割分担や進め方を考える方？' },
    { id:'Q16', archetype:'ruler', facet:'fear',   text:'ルールや指示がなくてバラバラだと、不安になる？' },
    // Everyman
    { id:'Q17', archetype:'everyman', facet:'desire', text:'クラスや部活でみんなと一緒に過ごせると安心する？' },
    { id:'Q18', archetype:'everyman', facet:'fear',   text:'自分だけ呼ばれなかったり浮くと気になる？' },
    // Jester
    { id:'Q19', archetype:'jester', facet:'desire', text:'空気が重いとき、冗談や一言で場を明るくしたくなる？' },
    { id:'Q20', archetype:'jester', facet:'fear',   text:'退屈な時間が続くとイライラする？' },
    // Lover
    { id:'Q21', archetype:'lover', facet:'desire', text:'大切にしたい人や物があると、自然とがんばれる？' },
    { id:'Q22', archetype:'lover', facet:'fear',   text:'自分の気持ちを無視されるのはつらい？' },
    // Innocent
    { id:'Q23', archetype:'innocent', facet:'desire', text:'人や世界を信じたい、もっと良い世界があるって思う？' },
    { id:'Q24', archetype:'innocent', facet:'fear',   text:'信じてたものに裏切られるとすごく落ち込む？' },
  ],
  gates: [
    { id:'Q25', text:'リーダーになるなら', A:{label:'前に出て引っ張る', archetype:'hero'},     B:{label:'全体をまとめる', archetype:'ruler'} },
    { id:'Q26', text:'楽しいのは',         A:{label:'新しいことを試す', archetype:'explorer'}, B:{label:'正しい答えを探す', archetype:'sage'} },
    { id:'Q27', text:'近いのは',           A:{label:'人と深くつながりたい', archetype:'lover'}, B:{label:'人を支えたい', archetype:'caregiver'} },
    { id:'Q28', text:'自分らしいのは',     A:{label:'場を盛り上げたい', archetype:'jester'},   B:{label:'みんなと同じ空気でいたい', archetype:'everyman'} },
    { id:'Q29', text:'変えるなら',         A:{label:'いらないものは壊す', archetype:'outlaw'},  B:{label:'工夫して変化を起こす', archetype:'magician'} },
    { id:'Q30', text:'ワクワクするのは',   A:{label:'知識を集めて理解する', archetype:'sage'},  B:{label:'形にして表現する', archetype:'creator'} },
  ],
};

// ▼ バリデーション
export function validateA12(payload){
  if (!payload || payload.version !== VERSION_A12) return { ok:false, reason:'version_mismatch' };
  const need = new Set([...QUESTIONS_A12.likert.map(q=>q.id), ...QUESTIONS_A12.gates.map(q=>q.id)]);
  const got = payload.answers ? new Set(Object.keys(payload.answers)) : new Set();
  for (const id of need) if (!got.has(id)) return { ok:false, reason:`missing_${id}` };
  for (const q of QUESTIONS_A12.likert) {
    const v = payload.answers[q.id];
    if (![1,2,3,4,5,6].includes(v)) return { ok:false, reason:`bad_value_${q.id}` };
  }
  for (const q of QUESTIONS_A12.gates) {
    const v = payload.answers[q.id];
    if (!['A','B'].includes(v)) return { ok:false, reason:`bad_value_${q.id}` };
  }
  return { ok:true };
}

// ▼ 採点（平均引き正規化 + 5%タイブレーク：Gate→Desire）
const zero = () => Object.fromEntries(ARCHETYPE_IDS.map(id=>[id,0]));

export function scoreA12(answers){
  const raw=zero(), desire=zero(), fear=zero(), gates=zero();

  // Likert 24
  for (const q of QUESTIONS_A12.likert) {
    const v = answers[q.id]; const pts = toPts(v);
    raw[q.archetype]+=pts; (q.facet==='desire'?desire:fear)[q.archetype]+=pts;
  }
  // Gates 6
  for (const g of QUESTIONS_A12.gates) {
    const k = answers[g.id]; const at = g[k]?.archetype;
    if (at) { raw[at]+=1; gates[at]+=1; }
  }

  const mean = ARCHETYPE_IDS.reduce((s,id)=>s+raw[id],0)/ARCHETYPE_IDS.length || 0;
  const normalized = Object.fromEntries(ARCHETYPE_IDS.map(id=>[id, raw[id]-mean]));
  const rank = ARCHETYPE_IDS.map(id=>({ id, score: normalized[id] })).sort((a,b)=>b.score-a.score);

  if (rank.length>1) {
    const [a,b] = rank;
    const denom = Math.max(Math.abs(a.score)+Math.abs(b.score),1);
    const close = Math.abs(a.score-b.score)/denom < 0.05;
    if (close) {
      const gateBias = gates[a.id]-gates[b.id];
      const desireBias = desire[a.id]-desire[b.id];
      if (gateBias<0 || (gateBias===0 && desireBias<0) || (gateBias===0 && desireBias===0 && a.id>b.id)) {
        rank[0]=b; rank[1]=a;
      }
    }
  }

  return {
    version: VERSION_A12,
    winner: { id: rank[0].id, raw: raw[rank[0].id], normalized: normalized[rank[0].id] },
    rank,
    detail: { raw, normalized, desire, fear, gates, mean }
  };
}

// ▼ 結果本文（ですます体）— シンプル版
export const RESULT_A12 = {
  hero: {
    titleJa:`${ARCHETYPE_LABELS.hero.ja}（${ARCHETYPE_LABELS.hero.en}）`,
    engine:'困っている人や難しい場面で「自分が役に立ちたい」と思える気持ちです。プレッシャーが大きいほど力を発揮し、仲間を引っ張ることで輝きます。',
    fear:'全力を出したのに結果につながらず、無力だったと感じることです。',
    seenAs:'勢いはあるが雑、独りよがりに見られることもあります。',
    scenes:[
      '文化祭や体育祭でトラブルが起きたときに前に立ち、場をまとめます。',
      '部活の試合で声を出してチームを鼓舞し、勝負所で頼られる存在になります。',
      'クラス討論で意見がバラバラなときに方向を示し、話を進めます。',
      '友達が落ち込んでいるときに率先して支え、信頼を集めます。'
    ],
    grow:[
      'ゴールを数字や形で明確に決めると集中できます。',
      '「ここまでできたらOK」と基準を作って取り組むと安心です。',
      '仲間に途中で確認してもらうことで独りよがりを防げます。'
    ],
    work:'リーダー役で輝きます。計画型の人と組むと成果が安定します。',
    chemistry:[
      'Explorer × Hero：「探検心 × 行動力」で挑戦が加速します。',
      'Caregiver × Hero：「支え × 勇気」で安心と挑戦が両立します。',
      'Ruler × Hero：「秩序 × 勝負勘」で現実的な成功につながります。'
    ],
  },
  outlaw:{
    titleJa:`${ARCHETYPE_LABELS.outlaw.ja}（${ARCHETYPE_LABELS.outlaw.en}）`,
    engine:'自分のやり方で進みたい気持ちです。古いルールを壊して新しい道を作ります。',
    fear:'細かいルールに縛られて自由を失うことがいちばん恐いです。',
    seenAs:'反抗的、協調しないと誤解されがちです。',
    scenes:[
      '企画で斬新な案を出します。','ムダな手順をカットします。',
      '独自のやり方で注目を集めます。','窮屈な空気をほぐします。'
    ],
    grow:[
      '改善案とセットで主張します。','小さく試して結果を見せます。','味方となる仲間を持ちます。'
    ],
    work:'自由度の高い場で力を発揮します。堅実な実行役と組むと現実化します。',
    chemistry:[
      'Magician × Outlaw：大胆な改革になります。',
      'Hero × Outlaw：困難を突破します。',
      'Creator × Outlaw：新しい表現が生まれます。'
    ],
  },
  explorer:{
    titleJa:`${ARCHETYPE_LABELS.explorer.ja}（${ARCHETYPE_LABELS.explorer.en}）`,
    engine:'未知を試したい好奇心です。新しい場所ややり方を探すほど生き生きします。',
    fear:'同じことの繰り返しで閉塞するのが恐いです。',
    seenAs:'落ち着きがない、腰が軽いと見られることがあります。',
    scenes:[
      '新ルートの調査を引き受けます。','体験会の先行テスターになります。',
      '情報収集と比較で最適解を見つけます。','班活動で新しいやり方を提案します。'
    ],
    grow:[
      '記録を残して共有します。','締切とゴールを可視化します。','伴走型の実行役とペアを組みます。'
    ],
    work:'調査・企画・新規開拓で力を発揮します。',
    chemistry:[
      'Sage × Explorer：探究が深まります。',
      'Hero × Explorer：挑戦が前に進みます。',
      'Creator × Explorer：新しい体験が形になります。'
    ],
  },
  creator:{
    titleJa:`${ARCHETYPE_LABELS.creator.ja}（${ARCHETYPE_LABELS.creator.en}）`,
    engine:'「ないなら作る」という創作衝動です。独自の表現で世界を彩ります。',
    fear:'オリジナリティが消え、同じになるのが恐いです。',
    seenAs:'気分屋で完遂力に不安があると見られることがあります。',
    scenes:[
      '企画書やビジュアルをゼロから形にします。','ネーミングやコピーで世界観を作ります。',
      'プロトタイプで場を動かします。','表現でチームを引きつけます。'
    ],
    grow:[
      '締切を早めに設定します。','レビューの場を定期化します。','ラスト1％まで詰める相棒を持ちます。'
    ],
    work:'クリエイティブ領域全般に向きます。',
    chemistry:[
      'Sage × Creator：説得力のある設計に。','Explorer × Creator：新体験が次々生まれます。','Jester × Creator：楽しい表現になります。'
    ],
  },
  sage:{
    titleJa:`${ARCHETYPE_LABELS.sage.ja}（${ARCHETYPE_LABELS.sage.en}）`,
    engine:'真理を知りたい知的好奇心です。根拠とロジックで世界を整理します。',
    fear:'思い込みや誤情報で誤らせることが恐いです。',
    seenAs:'理屈っぽい、冷たいと見られることがあります。',
    scenes:[
      '資料を読み込み事実をまとめます。','仮説検証で筋道を作ります。','根拠ある提案で説得します。','ナレッジベースを整備します。'
    ],
    grow:[
      '結論→理由の順で簡潔に話します。','図解や例で伝わりやすくします。','感情面の配慮を一言添えます。'
    ],
    work:'リサーチ・分析・教育に向きます。',
    chemistry:[
      'Explorer × Sage：広さ×深さが両立します。','Creator × Sage：設計の質が上がります。','Caregiver × Sage：伝わる支援になります。'
    ],
  },
  magician:{
    titleJa:`${ARCHETYPE_LABELS.magician.ja}（${ARCHETYPE_LABELS.magician.en}）`,
    engine:'変化を起こす仕掛け作りです。工夫で「できた！」を増やします。',
    fear:'努力しても何も変わらない停滞が恐いです。',
    seenAs:'奇抜、手段先行に見られることがあります。',
    scenes:[
      '面倒な手順を自動化します。','導線を工夫して体験を改善します。','新ツール導入をスムーズに進めます。','複数案を試して最適化します。'
    ],
    grow:[
      '目的→指標→手段の順に整理します。','小さく早く検証します。','定着まで運用設計をします。'
    ],
    work:'改善・プロダクト・運用設計に向きます。',
    chemistry:[
      'Outlaw × Magician：改革が現実化します。','Ruler × Magician：仕組み化が進みます。','Creator × Magician：新体験が洗練されます。'
    ],
  },
  caregiver:{
    titleJa:`${ARCHETYPE_LABELS.caregiver.ja}（${ARCHETYPE_LABELS.caregiver.en}）`,
    engine:'人を支えたい思いです。安心できる土台を作ります。',
    fear:'助けたいのに助けられない無力感が恐いです。',
    seenAs:'抱え込みがち、自己犠牲的に見られることがあります。',
    scenes:[
      '相談窓口を整えます。','イベント運営を段取り良く支えます。','トラブル時の一次対応を行います。','新メンバーのオンボーディングを担います。'
    ],
    grow:[
      '限界値と担当範囲を決めます。','任せる勇気を持ちます。','仕組み化して負荷を分散します。'
    ],
    work:'医療・教育・人事・運営に向きます。',
    chemistry:[
      'Hero × Caregiver：安心と挑戦の両立。','Ruler × Caregiver：安定運用。','Sage × Caregiver：根拠ある支援。'
    ],
  },
  ruler:{
    titleJa:`${ARCHETYPE_LABELS.ruler.ja}（${ARCHETYPE_LABELS.ruler.en}）`,
    engine:'秩序と安定を作る意欲です。みんなが動ける道筋を整えます。',
    fear:'ルール不在の混乱がいちばん恐いです。',
    seenAs:'堅い、保守的に見られることがあります。',
    scenes:[
      '役割分担とスケジュールを引きます。','リスクを洗い出して対応します。','意思決定の基準を作ります。','定例と記録で運営を安定化します。'
    ],
    grow:[
      '大枠だけ先に決めて走りながら調整します。','挑戦型の相棒と組みます。','意思決定を可視化します。'
    ],
    work:'管理・運営・ガバナンスに向きます。',
    chemistry:[
      'Hero × Ruler：突破×安定。','Magician × Ruler：変化の仕組み化。','Everyman × Ruler：現場に根づく運用。'
    ],
  },
  everyman:{
    titleJa:`${ARCHETYPE_LABELS.everyman.ja}（${ARCHETYPE_LABELS.everyman.en}）`,
    engine:'みんなと一緒にいる安心感です。輪の中で力を発揮します。',
    fear:'仲間外れや浮くことが恐いです。',
    seenAs:'目立たない、受け身に見られることがあります。',
    scenes:[
      '空気を読み場を整えます。','初参加者を輪に招きます。','チームの暗黙知を言語化します。','衝突をやわらげます。'
    ],
    grow:[
      '小さな主張を言ってみます。','役割を一つ持ちます。','強い個性の仲間と組みます。'
    ],
    work:'CS・運営・コミュニティで力を発揮します。',
    chemistry:[
      'Jester × Everyman：楽しくまとまります。','Ruler × Everyman：現場が回ります。','Caregiver × Everyman：安心の土台に。'
    ],
  },
  jester:{
    titleJa:`${ARCHETYPE_LABELS.jester.ja}（${ARCHETYPE_LABELS.jester.en}）`,
    engine:'楽しさで空気を軽くする力です。笑いで人をつなぎます。',
    fear:'退屈と重い空気がいちばん恐いです。',
    seenAs:'軽い、不真面目に見られることがあります。',
    scenes:[
      '会議の冒頭で緊張を解きます。','コンテンツにユーモアを足します。','イベントのMCを務めます。','情報発信をキャッチーにします。'
    ],
    grow:[
      'ふざける所と締める所を分けます。','相手の立場への配慮を添えます。','最後は成果に結びつけます。'
    ],
    work:'広報・MC・SNS・イベントで活躍します。',
    chemistry:[
      'Creator × Jester：楽しい表現に。','Everyman × Jester：場が和みます。','Hero × Jester：挑戦が明るく進みます。'
    ],
  },
  lover:{
    titleJa:`${ARCHETYPE_LABELS.lover.ja}（${ARCHETYPE_LABELS.lover.en}）`,
    engine:'大切な人・物・世界と深くつながりたい気持ちです。',
    fear:'気持ちを無視されることがいちばん恐いです。',
    seenAs:'感情的、依存的と見られることがあります。',
    scenes:[
      'ストーリーで共感を作ります。','デザインで美しさを伝えます。',
      'チームの関係性を整えます。','ファンとの対話を深めます。'
    ],
    grow:[
      '言語化して共有します。','境界線（やらない範囲）を決めます。','数値指標とセットで語ります。'
    ],
    work:'ブランド・デザイン・広報に向きます。',
    chemistry:[
      'Caregiver × Lover：温かい支援に。','Creator × Lover：美しい世界観に。','Sage × Lover：伝わる言葉に。'
    ],
  },
  innocent:{
    titleJa:`${ARCHETYPE_LABELS.innocent.ja}（${ARCHETYPE_LABELS.innocent.en}）`,
    engine:'希望と信頼で動きます。良い未来があると信じて前に進みます。',
    fear:'信じていたものに裏切られることが恐いです。',
    seenAs:'理想論、現実逃避と見られることがあります。',
    scenes:[
      'チームの理念や約束事を守ります。','ムードが荒れたとき希望を示します。',
      '善意を軸にした企画を進めます。','継続的な習慣作りを支えます。'
    ],
    grow:[
      '理想を一歩目の行動に割ります。','現実担当の相棒と組みます。','小さな達成を積み上げます。'
    ],
    work:'教育・NPO・コミュニティに向きます。',
    chemistry:[
      'Ruler × Innocent：理想が仕組みになります。','Caregiver × Innocent：優しさが広がります。','Hero × Innocent：理想が行動に変わります。'
    ],
  },
};
