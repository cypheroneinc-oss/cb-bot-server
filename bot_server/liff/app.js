/* /bot_server/liff/app.js まるっと置換 */

const LIFF_ID = '2008019437-Jxwm33XM'; // か、後述の index.html から data-liff-id で渡す

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const QUESTIONS = [
  { id: "q1", title: "仕事の進め方のスタンス", q: "何かに取りかかるとき、近いのは？",
    a: [{k:"A",t:"とりあえず始めて、やりながら直す"}, {k:"B",t:"まず全体を整理してから始める"}] },
  { id: "q2", title: "判断の決め手", q: "悩んだとき、より大事にするのは？",
    a: [{k:"A",t:"なんとなくの直感やフィーリング"}, {k:"B",t:"理由やデータなどの根拠"}] },
  { id: "q3", title: "やる気が出る理由（複数OK）", q: "「よし、がんばろう！」と思えるのは？",
    multi:true,
    a:[
      {k:"1",t:"成果を出したとき（達成感）"},{k:"2",t:"認められたり褒められたとき（承認）"},
      {k:"3",t:"誰かの役に立ったとき（貢献）"},{k:"4",t:"安心できる環境があるとき（安心）"},
      {k:"5",t:"新しいことを知れたとき（探究）"},{k:"6",t:"自分のやり方で自由にできるとき（自由）"},
      {k:"7",t:"仲間と一緒に動けるとき（仲間）"},{k:"8",t:"成長している実感があるとき（成長）"}
    ]},
  { id: "q4", title: "苦手な環境", q: "どちらの方がイヤ？",
    a: [{k:"A",t:"ずっと細かく指示される"}, {k:"B",t:"ほったらかしで丸投げされる"}] },
  { id: "q5", title: "感情の出し方", q: "気持ちが盛り上がったとき、近いのは？",
    a: [{k:"A",t:"顔や言葉にすぐ出る"}, {k:"B",t:"外には出ないけど心の中で燃える"}] },
  { id: "q6", title: "安心できるチーム", q: "一緒にいてラクなのは？",
    a: [{k:"A",t:"何でもハッキリ言えるチーム"}, {k:"B",t:"空気を大事にして、和やかなチーム"}] },
  { id: "q7", title: "チームでの役割", q: "自然に多いのは？",
    a: [{k:"A",t:"みんなを引っ張るリーダー役"}, {k:"B",t:"サポートして支える役"}] },
  { id: "q8", title: "働き方の理想", q: "理想に近いのは？",
    a: [{k:"A",t:"一つのことをじっくり極める"}, {k:"B",t:"いろんなことに同時にチャレンジする"}] },
];

// 判定ロジック（やさしい日本語のテキストもここで返す）
function diagnose(ans) {
  // 基本軸: A/B カウント
  const abKeys = ["q1","q2","q4","q5","q6","q7","q8"];
  let aCount = 0, bCount = 0;
  abKeys.forEach(k=>{
    if (ans[k]==="A") aCount++;
    if (ans[k]==="B") bCount++;
  });

  // 動機トップ3
  const motif = (ans.q3 || []).slice().sort(); // 文字列配列
  const motifMap = {
    "1":"達成感","2":"承認","3":"貢献","4":"安心","5":"探究","6":"自由","7":"仲間","8":"成長"
  };
  const motifNames = motif.map(m=>motifMap[m]).slice(0,3);

  // タイプ判定（ざっくり / 子どもでもわかる表現）
  let type, workStyle, roles, jobs, advice;
  if (bCount > aCount) {
    type = "コツコツ計画タイプ";
    workStyle = "じっくり考えてから、ていねいに進めるのが得意";
    roles = "まとめ役のサポート・設計係";
    jobs = "企画・分析・経理・品質管理・PM補佐 など";
    advice = "始める前に計画を作るのはグッド。やりながらの見直しも少し取り入れてみよう。";
  } else {
    type = "グイグイ行動タイプ";
    workStyle = "まずやってみて、動きながら形にするのが得意";
    roles = "先頭でひっぱる係・アイデア係";
    jobs = "営業・CS・広報・プロデューサー・スタートアップ全般 など";
    advice = "思いついたら試す強みは最高。ときどき“理由メモ”を残すと、もっと強くなる。";
  }

  // いくつかの回答で微調整（例）
  if (ans.q6==="B") { // 和やかチーム好き
    roles += "（空気づくり名人）";
  }
  if ((ans.q3||[]).includes("5")) { // 探究
    jobs += " / リサーチ・UX・コンテンツ企画";
  }

  return {
    type, summary: workStyle,
    bestFit: roles,
    goodJobs: jobs,
    advice,
    motifsTop3: motifNames
  };
}

async function init() {
  $('#status').textContent = 'LIFF 初期化中…';
  const liffId = LIFF_ID || document.body.dataset.liffId;
  await liff.init({ liffId });

  // アプリ外ブラウザならログイン誘導（開発時のアクセスもOKにする）
  if (!liff.isInClient() && !liff.isLoggedIn()) {
    $('#status').textContent = 'ログインへリダイレクトします…';
    return liff.login();
  }

  const prof = await liff.getProfile();
  $('#status').innerHTML = `こんにちは、<b>${prof.displayName}</b> さん！`;
  $('#userId').textContent = prof.userId;

  // UIを描画
  renderForm();

  $('#submit').addEventListener('click', async ()=>{
    const answers = collectAnswers();
    const result = diagnose(answers);

    // 画面に表示
    renderResult(result);

    // サーバへ送信（運営側保存）
    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          line_user_id: prof.userId,
          answers,
          result
        })
      });
      if (!res.ok) throw new Error(await res.text());
      toast('結果を送信しました（運営に保存済み）');
    } catch(e) {
      console.error(e);
      toast('送信に失敗しました。通信環境を確認してください。');
    }
  });
}

function renderForm() {
  const box = $('#questions');
  box.innerHTML = '';
  QUESTIONS.forEach(q=>{
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'q-title';
    title.textContent = `${q.title}`;
    const qtext = document.createElement('div');
    qtext.className = 'q-text';
    qtext.textContent = `Q: ${q.q}`;

    const ul = document.createElement('div');
    ul.className = 'choices';

    if (q.multi) {
      q.a.forEach(opt=>{
        const id = `${q.id}_${opt.k}`;
        ul.insertAdjacentHTML('beforeend', `
          <label class="opt">
            <input type="checkbox" name="${q.id}" value="${opt.k}" />
            <span>${opt.t}</span>
          </label>
        `);
      });
    } else {
      q.a.forEach(opt=>{
        ul.insertAdjacentHTML('beforeend', `
          <label class="opt">
            <input type="radio" name="${q.id}" value="${opt.k}" />
            <span>${opt.t}</span>
          </label>
        `);
      });
    }

    card.append(title,qtext,ul);
    box.append(card);
  });
}

function collectAnswers() {
  const out = {};
  QUESTIONS.forEach(q=>{
    if (q.multi) {
      const vals = $$(`input[name="${q.id}"]:checked`).map(i=>i.value);
      out[q.id] = vals;
    } else {
      const el = $(`input[name="${q.id}"]:checked`);
      out[q.id] = el ? el.value : null;
    }
  });
  return out;
}

function renderResult(r) {
  $('#type').textContent = r.type;
  $('#work').textContent = r.summary;
  $('#roles').textContent = r.bestFit;
  $('#jobs').textContent = r.goodJobs;
  $('#advice').textContent = r.advice;
  $('#motifs').textContent = r.motifsTop3.join('・');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
  script.onload = init;
  document.head.appendChild(script);
});
