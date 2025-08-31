/* ===== 設定 =====
   1) Vercel 環境変数 LIFF_ID を設定済みなら、サーバから埋め込む形で window.LIFF_ID を仕込めます。
      もし未導入なら下行の 'YOUR_LIFF_ID' を手動で差し替えでもOK。 */
const LIFF_ID = window.LIFF_ID || '2008019437-Jxwm33XM';

/* ===== ユーティリティ ===== */
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...children) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const c of children) n.append(c);
  return n;
};
const toast = (msg) => {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
};

/* ===== 質問定義（要件通り） ===== */
const QUESTIONS = [
  {
    id: 'q1',
    title: '1. 仕事の進め方のスタンス',
    caption: 'Q: 何かに取りかかるとき、近いのは？',
    type: 'radio',
    options: [
      { value: 'A', label: 'A. とりあえず始めて、やりながら直す' },
      { value: 'B', label: 'B. まず全体を整理してから始める' },
    ],
  },
  {
    id: 'q2',
    title: '2. 判断の決め手',
    caption: 'Q: 悩んだとき、より大事にするのは？',
    type: 'radio',
    options: [
      { value: 'A', label: 'A. なんとなくの直感やフィーリング' },
      { value: 'B', label: 'B. 理由やデータなどの根拠' },
    ],
  },
  {
    id: 'q3',
    title: '3. やる気が出る理由（複数OK）',
    caption: 'Q: 「よし、がんばろう！」と思えるのは？（複数OK）',
    type: 'checkbox',
    options: [
      { value: '成果', label: '成果を出したとき（達成感）' },
      { value: '承認', label: '認められたり褒められたとき（承認）' },
      { value: '貢献', label: '誰かの役に立ったとき（貢献）' },
      { value: '安心', label: '安心できる環境があるとき（安心）' },
      { value: '探究', label: '新しいことを知れたとき（探究）' },
      { value: '自由', label: '自分のやり方で自由にできるとき（自由）' },
      { value: '仲間', label: '仲間と一緒に動けるとき（仲間）' },
      { value: '成長', label: '成長している実感があるとき（成長）' },
    ],
    required: true,
  },
  {
    id: 'q4',
    title: '4. 苦手な環境',
    caption: 'Q: どちらの方がイヤ？',
    type: 'radio',
    options: [
      { value: 'A', label: 'A. ずっと細かく指示される' },
      { value: 'B', label: 'B. ほったらかしで丸投げされる' },
    ],
  },
  {
    id: 'q5',
    title: '5. 感情の出し方',
    caption: 'Q: 気持ちが盛り上がったとき、近いのは？',
    type: 'radio',
    options: [
      { value: 'A', label: 'A. 顔や言葉にすぐ出る' },
      { value: 'B', label: 'B. 外には出ないけど心の中で燃える' },
    ],
  },
  {
    id: 'q6',
    title: '6. 安心できるチーム',
    caption: 'Q: 一緒にいてラクなのは？',
    type: 'radio',
    options: [
      { value: 'A', label: 'A. 何でもハッキリ言えるチーム' },
      { value: 'B', label: 'B. 空気を大事にして、和やかなチーム' },
    ],
  },
  {
    id: 'q7',
    title: '7. チームでの役割',
    caption: 'Q: 自然に多いのは？',
    type: 'radio',
    options: [
      { value: 'A', label: 'A. みんなを引っ張るリーダー役' },
      { value: 'B', label: 'B. サポートして支える役' },
    ],
  },
  {
    id: 'q8',
    title: '8. 働き方の理想',
    caption: 'Q: 理想に近いのは？',
    type: 'radio',
    options: [
      { value: 'A', label: 'A. 一つのことをじっくり極める' },
      { value: 'B', label: 'B. いろんなことに同時にチャレンジする' },
    ],
  },
];

/* ===== 結果ロジック（子どもにもわかる言葉） ===== */
const RESULT_RULES = {
  // Q1（進め方）× Q2（判断）
  // 4象限タイプ名と説明
  matrix: {
    AA: {
      type: 'ひらめきダッシュ型',
      tags: ['すぐ動く','直感が強い'],
      ways: ['小さく始めてすぐ試す','自由度の高い環境'],
      roles: ['新規事業','SNS・企画','営業'],
      advice: 'まずやってみる長所は最高！ただし、ゴールだけはメモしてから走ると失敗が減るよ。'
    },
    AB: {
      type: '計画ダッシュ型',
      tags: ['すぐ動く','理由も大事'],
      ways: ['軽く設計→すぐ実行','短いサイクルで改善'],
      roles: ['PdM/PM','マーケ運用','法人営業'],
      advice: '走りながら考えられる器用タイプ。やる前に「何を測るか」だけ決めると勝率UP！'
    },
    BA: {
      type: 'ひらめき職人型',
      tags: ['慎重','直感が強い'],
      ways: ['集中できる時間ブロック','少人数でのものづくり'],
      roles: ['デザイン','クリエイティブ','リサーチ'],
      advice: '感性が光る。締切とチェックポイントを作ると作品の質がさらに上がるよ。'
    },
    BB: {
      type: '設計職人型',
      tags: ['慎重','ロジック派'],
      ways: ['手順が明確な業務','深掘り・検証'],
      roles: ['エンジニア','データ分析','品質保証'],
      advice: '丁寧で正確。完璧主義になりすぎた時は「まず仮で出す」を合言葉にしよう。'
    }
  },
  // Q3（モチベ上位）をタイプに少しブレンド
  boostersMap: {
    成果:'結果にこだわる', 承認:'褒められると伸びる', 貢献:'人の役に立ちたい',
    安心:'落ち着いた環境が好き', 探究:'学ぶのが好き', 自由:'やり方は自由が良い',
    仲間:'チームで燃える', 成長:'成長実感で加速'
  }
};

/* ===== 画面描画 ===== */
function renderForm() {
  const area = $('#formArea');
  area.innerHTML = '';
  for (const q of QUESTIONS) {
    const card = el('div', { className:'card' });
    card.append(
      el('h3', { textContent: q.title }),
      el('div', { className:'q-caption', textContent: q.caption })
    );
    if (q.type === 'radio') {
      q.options.forEach((op, i) => {
        const id = `${q.id}_${op.value}`;
        const row = el('label', { className:'opt' },
          el('input', { type:'radio', name:q.id, id, value:op.value }),
          el('span', { textContent: op.label }),
        );
        if (i===0) row.querySelector('input').required = true;
        card.append(row);
      });
    } else {
      // checkbox
      q.options.forEach((op) => {
        const id = `${q.id}_${op.value}`;
        card.append(
          el('label', { className:'opt small' },
            el('input', { type:'checkbox', name:q.id, id, value:op.value, style:'border-radius:4px' }),
            el('span', { textContent: op.label })
          )
        );
      });
    }
    area.append(card);
  }
}

function collectAnswers() {
  const ans = {};
  for (const q of QUESTIONS) {
    if (q.type === 'radio') {
      const picked = document.querySelector(`input[name="${q.id}"]:checked`);
      ans[q.id] = picked ? picked.value : null;
    } else {
      const picked = [...document.querySelectorAll(`input[name="${q.id}"]:checked`)].map(x=>x.value);
      ans[q.id] = picked;
    }
  }
  return ans;
}

/* ===== スコア計算（ローカル） ===== */
function calcResult(ans) {
  const key = (ans.q1 || 'A') + (ans.q2 || 'B'); // デフォルト保険
  const base = RESULT_RULES.matrix[key] || RESULT_RULES.matrix.AB;
  // モチベ強化タグ（最大3個）
  const motTags = (ans.q3 || []).slice(0,3).map(k => RESULT_RULES.boostersMap[k]).filter(Boolean);
  const typeName = base.type;
  const tags = [...base.tags, ...motTags];
  return {
    typeName,
    tags,
    fitWays: base.ways,
    roles: base.roles,
    advice: base.advice
  };
}

/* ===== 結果の描画 ===== */
function chips(parent, arr) {
  parent.innerHTML = '';
  arr.forEach(t => parent.append(el('span',{className:'pill', textContent:t})));
}
function showResult(r) {
  $('#resultBox').classList.remove('hide');
  $('#typeName').textContent = r.typeName;
  chips($('#typeTags'), r.tags);
  chips($('#fitWays'), r.fitWays);
  chips($('#roles'), r.roles);
  $('#advice').textContent = r.advice;
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

/* ===== サーバ送信（保存用） ===== */
async function sendToServer(payload){
  try{
    const res = await fetch('/api/answer', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json(); // サーバ側で集計するなら { result: {...} } を返す
  }catch(e){
    // サーバに依存しない：失敗はUIに出さずトーストのみ
    console.warn('save failed:', e);
    toast('通信できませんでした（端末内で結果表示します）');
    return null;
  }
}

/* ===== LIFF 初期化 ===== */
async function initLIFF(){
  $('#status').textContent = 'LIFFを起動中…';
  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) return liff.login();
  const prof = await liff.getProfile();
  $('#who').textContent = `${prof.displayName} さん`;
  $('#status').innerHTML = `ログインOK<span class="ok">（${liff.isInClient() ? 'トーク内' : '外部ブラウザ'}）</span>`;
  return prof;
}

/* ===== 起動 ===== */
(async function start(){
  try {
    renderForm();
    const prof = await initLIFF();

    $('#submitBtn').addEventListener('click', async () => {
      // 入力拾う
      const answers = collectAnswers();

      // Q3がゼロ件なら注意（任意で必須に）
      if (!answers.q3 || answers.q3.length === 0){
        toast('「3. やる気が出る理由」を1つ以上選んでね');
        return;
      }

      // まずローカルで即時結果
      const local = calcResult(answers);
      showResult(local);

      // 送信（失敗してもOK）
      const payload = {
        line_user_id: prof.userId,
        answers,
        meta: { time: new Date().toISOString(), displayName: prof.displayName },
      };
      const server = await sendToServer(payload);

      // サーバが result を返す仕様なら、それで上書き（なければ無視）
      if (server && server.result) showResult(server.result);
    });

  } catch (e) {
    console.error(e);
    $('#status').innerHTML = `<span class="err">エラー：</span>${e.message || e}`;
  }
})();
