// bot_server/lib/scorer.js

/** 受け取る answers 例
{
  q1:'A'|'B',
  q2:'A'|'B',
  q3:['成果','承認','貢献',…], // 複数可（順不同でOK）
  q4:'A'|'B',
  q5:'A'|'B',
  q6:'A'|'B',
  q7:'A'|'B',
  q8:'A'|'B'
}
*/

const J = (arr) => Array.isArray(arr) ? arr : [];

const toNum = v => (v === 'A' ? 1 : v === 'B' ? -1 : 0);

/**
 * タイプ判定：
 *  - 主要2軸（q1: スタート/設計, q2: 直感/論理）で4象限タイプに分類
 *    EX: Explorer（スピード×直感）
 *    AR: Architect（設計×論理）
 *    DR: Driver（スピード×論理）
 *    CO: Connector（設計×直感）
 *  - 補助の軸（q5, q6, q7, q8 等）でレコメンドを微調整
 */
export function scoreToType(answers) {
  const s1 = toNum(answers.q1); // +1=とりあえず始める / -1=まず整理
  const s2 = toNum(answers.q2); // +1=直感 / -1=論理

  let type = 'EX';
  if (s1 >= 0 && s2 >= 0) type = 'EX';            // スピード×直感
  if (s1 < 0  && s2 < 0) type = 'AR';             // 設計×論理
  if (s1 >= 0 && s2 < 0) type = 'DR';             // スピード×論理
  if (s1 < 0  && s2 >= 0) type = 'CO';            // 設計×直感
  return type;
}

/**
 * タイプごとの文面・おすすめ職種などを返す。
 * answers を渡すと、モチベーション（q3）や補助軸から一部をカスタムします。
 */
export function typeMessage(t, answers = {}) {
  const motivations = J(answers.q3); // 例: ['成果','承認','貢献']
  const expressive = toNum(answers.q5) > 0;   // A=表に出る
  const directTeam = toNum(answers.q6) > 0;   // A=ハッキリ言える
  const leaderLike = toNum(answers.q7) > 0;   // A=リーダー役
  const specialist = toNum(answers.q8) > 0;   // A=専門特化

  // モチベーションTop3だけ抜粋（あれば）
  const motTop = motivations.slice(0, 3);
  const motLine = motTop.length ? `あなたのモチベーション上位：${motTop.join(' / ')}` : 'あなたのモチベーション上位：未選択';

  // 補助的な推し職種を組み立て
  const push = (arr) => arr.filter(Boolean);

  const base = {
    EX: {
      title: 'Explorer（スピード×直感）',
      body: [
        '動きながら学び、変化に強いタイプ。',
        '未知の領域でもまず試して前に進めます。'
      ].join('\n'),
      fit: '合う働き方：短いサイクルで検証 / 現場で意思決定 / 裁量がある環境',
      jobs: push([
        '新規事業・BizDev',
        'グロースマーケ',
        'インサイドセールス / フィールドセールス',
        leaderLike ? 'プロダクトマネージャー' : null,
      ]),
      tips: [
        '走り出す前に目的と成功条件を一言で確認するとさらに強い',
        '直感を言語化するメモを残すとチーム連携◎'
      ],
    },
    AR: {
      title: 'Architect（設計×論理）',
      body: [
        'まず全体像を掴み、構造化してから動くタイプ。',
        '再現性のある仕組みを作るのが得意です。'
      ].join('\n'),
      fit: '合う働き方：要件定義 / 手順化 / 長期目線での最適化',
      jobs: push([
        'プロジェクトマネジメント',
        '業務設計 / オペレーション設計',
        specialist ? 'データアナリスト' : '企画職',
        '品質管理 / CSオペレーション',
      ]),
      tips: [
        '完璧化の前に8割で出してフィードバックを回す癖を',
        '意思決定の速度を上げるための「締め切り」を置く'
      ],
    },
    DR: {
      title: 'Driver（スピード×論理）',
      body: [
        '目的から逆算し、素早く実行して結果を出すタイプ。',
        'KPI志向・グリット強めで推進力が高い。'
      ].join('\n'),
      fit: '合う働き方：数値責任 / 目標管理 / 短期〜中期の成果創出',
      jobs: push([
        'セールス（ハンター）',
        '広告運用 / パフォーマンスマーケ',
        leaderLike ? '営業マネージャー' : '事業オペレーション',
      ]),
      tips: [
        '中長期の仕込み（関係構築・ブランド）も月1で点検を',
        '数値以外のチーム感情に目を向けると持続性UP'
      ],
    },
    CO: {
      title: 'Connector（設計×直感）',
      body: [
        '人や情報をつなぎ、チームで成果を最大化するタイプ。',
        '杓子定規でなく状況に合わせた最適化が得意。'
      ].join('\n'),
      fit: '合う働き方：調整 / ファシリテーション / 関係構築',
      jobs: push([
        'カスタマーサクセス',
        '採用・HR / 広報',
        expressive ? 'コミュニティマネージャー' : 'アカウントマネージャー',
      ]),
      tips: [
        '役割が曖昧になりがちなので「守備範囲」を先に宣言',
        '数字の見せ方を磨くと説得力が跳ねます'
      ],
    },
  };

  const chosen = base[t] || base.EX;

  // サブ軸から一言カスタム
  const subNotes = [];
  subNotes.push(leaderLike ? '傾向：リーダー役がハマりやすい' : '傾向：支える役で真価を発揮しやすい');
  subNotes.push(directTeam ? 'チーム：率直に言い合える文化が安心' : 'チーム：和やかで配慮のある文化が安心');
  subNotes.push(specialist ? '志向：専門性を深めると強い' : '志向：幅広く掛け合わせると強い');

  return {
    title: chosen.title,
    body: [chosen.body, '', motLine].join('\n'),
    fit: chosen.fit,
    jobs: chosen.jobs,
    tips: [...chosen.tips, ...subNotes],
  };
}
