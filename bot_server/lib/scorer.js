// 回答オブジェクト => 4象限タイプ + 補足を生成
// answers の形：{ q1:'A|B', q2:'A|B', q3:['成果','承認',...], q4:'A|B', q5:'A|B', q6:'A|B', q7:'A|B', q8:'A|B' }

export function scoreToType(answers) {
  const { q1, q2, q3 = [], q4, q5, q6, q7, q8 } = answers || {};

  // 主要タイプ（2軸）
  // q1: 行動(A) / 計画(B)
  // q2: 直感(A) / 論理(B)
  const axis1 = q1 === 'A' ? '行動' : '計画';
  const axis2 = q2 === 'A' ? '直感' : '論理';

  const code = `${q1||'?'}${q2||'?'}`; // AA, AB, BA, BB のいずれか
  const map = typeMessage(code);

  // 補足ラベル
  const envPrefer = q4 === 'A' ? '細かい指示は苦手（自律に裁量を）' : '丸投げは苦手（適度な伴走を）';
  const emotion   = q5 === 'A' ? '感情は表に出やすい（熱量共有タイプ）' : '感情は内側で燃える（落ち着きタイプ）';
  const team      = q6 === 'A' ? '率直に言い合えるチームがラク' : '和やかに協調するチームがラク';
  const role      = q7 === 'A' ? 'リーダー寄り' : 'サポーター寄り';
  const workStyle = q8 === 'A' ? '一つを極める職人型' : '同時多発で挑戦するゼネラリスト型';

  return {
    result_type: map.type,          // 例: AI / AL / PI / PL
    title: map.title,
    body: map.body.replaceAll('{axis1}', axis1).replaceAll('{axis2}', axis2),
    fit: map.fit,
    motivations: q3,                // 選択順＝優先順位
    env_prefer: envPrefer,
    emotion,
    team,
    role,
    work_style: workStyle
  };
}

export function typeMessage(code) {
  // code は 'AA','AB','BA','BB' のいずれか
  // A=行動/直感, B=計画/論理
  const dict = {
    'AA': {
      type: 'AI',
      title: 'ひらめきダッシュ型（直感×行動）',
      body: '「{axis2}」を頼りにまず動き、試しながら学ぶタイプ。スピード感が武器。細かな手順より方向性が合えば走れる。',
      fit: '短期実験／プロトタイプ作り／新規立ち上げ。裁量と反応速度がある環境。'
    },
    'AB': {
      type: 'AL',
      title: '現場ロジカル型（論理×行動）',
      body: '動きながらも「{axis2}」で筋道を立てるタイプ。改善・検証のループが得意。数字や根拠があるとさらに強い。',
      fit: 'KPI運用／グロース／オペレーション改善。仮説→実行→検証の回転が早い仕事。'
    },
    'BA': {
      type: 'PI',
      title: '俯瞰クリエイティブ型（直感×計画）',
      body: 'まず全体像を描き「{axis2}」で可能性を広げるタイプ。設計・構想・編集が得意。仕組み化で力を発揮。',
      fit: '企画設計／情報整理／体験設計。余白と考える時間がある環境。'
    },
    'BB': {
      type: 'PL',
      title: '緻密プランナー型（論理×計画）',
      body: '事前に筋道を整える「{axis2}」タイプ。品質・安定性・再現性を重視。精度の高い準備で成果につなげる。',
      fit: 'プロジェクト管理／品質保証／分析・リサーチ。要件が明確な仕事。'
    }
  };
  return dict[code] || {
    type: 'UNKNOWN',
    title: 'タイプ算出に不足があります',
    body: '未回答の設問があります。',
    fit: 'もう一度選び直してください。'
  };
}
