/* ===== セットアップ =====
 * 必要ならここを直接 LIFF_ID に置き換え（例: '2000-xxxx'）
 * ※Vercelで静的ファイルからenvを参照できないため、直書きが確実です
 */
const LIFF_ID = '2008019437-Jxwm33XM';

// API エンドポイント（そのままでOK）
const API_ANSWER = '/api/answer';

// ヘルパ
const $ = (s) => document.querySelector(s);
const el = (t, attrs = {}, ...children) => {
  const n = document.createElement(t);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'for') n.htmlFor = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  });
  for (const c of children) n.append(c);
  return n;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 設問データ（日本語やさしめ＆キャッチー）
const QUESTIONS = [
  {
    id: 'q1', title: '1. 仕事の進め方', prompt: '近いのは？', type: 'single',
    options: [
      { id:'A', label:'A. とりあえず始めて直す' },
      { id:'B', label:'B. まず整理してから始める' },
    ]
  },
  {
    id: 'q2', title: '2. 判断の決め手', prompt: 'より大事にするのは？', type: 'single',
    options: [
      { id:'A', label:'A. 直感・フィーリング' },
      { id:'B', label:'B. データや理由' },
    ]
  },
  {
    id: 'q3', title: '3. やる気スイッチ', prompt: '当てはまるものにチェック（複数OK）', type: 'multi',
    options: [
      { id:'1', label:'成果達成' }, { id:'2', label:'承認' }, { id:'3', label:'貢献' }, { id:'4', label:'安心' },
      { id:'5', label:'探究' }, { id:'6', label:'自由' }, { id:'7', label:'仲間' }, { id:'8', label:'成長' },
    ]
  },
  {
    id: 'q4', title: '4. 苦手な環境', prompt: 'どちらがイヤ？', type: 'single',
    options: [
      { id:'A', label:'A. ずっと細かく指示される' },
      { id:'B', label:'B. ほったらかしで丸投げ' },
    ]
  },
  {
    id: 'q5', title: '5. 感情の出し方', prompt: '近いのは？', type: 'single',
    options: [
      { id:'A', label:'A. 顔や言葉にすぐ出る' },
      { id:'B', label:'B. 外には出ないけど心で燃える' },
    ]
  },
  {
    id: 'q6', title: '6. 安心できるチーム', prompt: 'ラクなのは？', type: 'single',
    options: [
      { id:'A', label:'A. 何でもハッキリ言える' },
      { id:'B', label:'B. 空気を大事にして和やか' },
    ]
  },
  {
    id: 'q7', title: '7. 役割', prompt: '自然に多いのは？', type: 'single',
    options: [
      { id:'A', label:'A. みんなを引っ張るリーダー' },
      { id:'B', label:'B. サポートして支える' },
    ]
  },
  {
    id: 'q8', title: '8. 働き方の理想', prompt: '理想に近いのは？', type: 'single',
    options: [
      { id:'A', label:'A. 一つのことをじっくり極める' },
      { id:'B', label:'B. いろんなことに同時にチャレンジ' },
    ]
  },
];

// 診断ロジック（子どもにもわかる言葉）
function scoreAndExplain(ans) {
  // 野生（直感・スピード） vs 計画（整理・根拠）
  let wild = 0, plan = 0;
  if (ans.q1 === 'A') wild++; else if (ans.q1 === 'B') plan++;
  if (ans.q2 === 'A') wild++; else if (ans.q2 === 'B') plan++;
  if (ans.q4 === 'A') plan++; else if (ans.q4 === 'B') wild++;
  if (ans.q8 === 'A') plan++; else if (ans.q8 === 'B') wild++;

  const type =
    wild > plan ? 'ひらめきスプリンター' :
    plan > wild ? 'じっくりプランナー' : 'ミックス型バランサー';

  const workStyle =
    wild > plan ? 'まず動いて、失敗から学ぶスタイル' :
    plan > wild ? '準備して、すき間なく進めるスタイル' :
    '状況に合わせて切り替えるスタイル';

  // モチベーション上位（最大3件）
  const motives = (ans.q3 || []).slice(0, 3).map(id => ({
    '1':'成果が出たとき','2':'ほめられたとき','3':'誰かの役に立てたとき','4':'安心できるとき',
    '5':'新しい発見があったとき','6':'自分のやり方でできたとき','7':'仲間と一緒のとき','8':'成長を感じたとき'
  }[id]));

  // 向いている職種の例
  let jobs;
  if (type === 'ひらめきスプリンター') {
    jobs = ['営業','企画','広報','プロダクトマネジメント','起業/新規事業'];
  } else if (type === 'じっくりプランナー') {
    jobs = ['エンジニア','データ分析','経理/法務','品質管理','編集/ドキュメント'];
  } else {
    jobs = ['カスタマーサクセス','プロジェクト進行','人事/採用','マーケティング','ディレクション'];
  }

  // アドバイス
  const adv = [];
  if (type === 'ひらめきスプリンター') {
    adv.push('やることを3つだけにしぼると超はかどる。');
    adv.push('思いつきをメモ→2分で検証、のくり返しが最強。');
  } else if (type === 'じっくりプランナー') {
    adv.push('完璧にする前に小さく出してみよう。');
    adv.push('やる順番をカード化→毎日少しずつ更新でOK。');
  } else {
    adv.push('切り替え上手を武器に、役割を2つまでにしぼる。');
    adv.push('困ったら「目的→手順→担当」の順で整える。');
  }

  return { type, workStyle, motives, jobs, adv };
}

// UI生成
function renderQuestions(container) {
  container.innerHTML = '';
  QUESTIONS.forEach((q, idx) => {
    const sec = el('section', { class: 'card' });
    sec.append(
      el('div', { class: 'title', text: `${q.title}` }),
      el('div', { class: 'q', text: `Q: ${q.prompt}` })
    );

    const row = el('div', { class: 'grid' });
    q.options.forEach(opt => {
      const inputId = `${q.id}_${opt.id}`;
      const input = el('input', {
        type: q.type === 'multi' ? 'checkbox' : 'radio',
        name: q.id, id: inputId, value: opt.id
      });
      const label = el('label', { class: 'pill', for: inputId });
      label.append(input, el('span', { text: opt.label }));
      row.append(label);
    });
    sec.append(row);
    container.append(sec);
  });
}

// 回答の読み取りとバリデーション
function collectAnswers() {
  const out = {};
  for (const q of QUESTIONS) {
    if (q.type === 'single') {
      const checked = document.querySelector(`input[name="${q.id}"]:checked`);
      if (!checked) return { error: `${q.title} を選んでください` };
      out[q.id] = checked.value;
    } else {
      const arr = [...document.querySelectorAll(`input[name="${q.id}"]:checked`)].map(i => i.value);
      out[q.id] = arr;
    }
  }
  return { data: out };
}

// API送信
async function postAnswers(payload) {
  const res = await fetch(API_ANSWER, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`POST ${res.status}`);
  return res.json().catch(()=> ({}));
}

// 画面更新
function showResult(r, logObj) {
  $('#typeBadge').textContent = `タイプ：${r.type}`;
  $('#workBadge').textContent = `合う働き方：${r.workStyle}`;
  $('#summary').textContent = r.motives.length ? `あなたのやる気スイッチ：${r.motives.join('・')}` : 'やる気スイッチ：未選択';
  $('#jobs').innerHTML = r.jobs.map(j=>`<li>${j}</li>`).join('');
  $('#advs').innerHTML = r.adv.map(a=>`<li>${a}</li>`).join('');
  $('#log').textContent = JSON.stringify(logObj, null, 2);
  $('#result').style.display = '';
}

// 初期化
(async function init(){
  try{
    $('#bar').style.width = '25%';
    await liff.init({ liffId: LIFF_ID });
    $('#bar').style.width = '45%';

    // LIFF内で未ログイン→ログインへ
    if (!liff.isLoggedIn()) {
      $('#bar').style.width = '55%';
      return liff.login();
    }

    const prof = await liff.getProfile();
    const userId = prof.userId || 'unknown';
    $('#bar').style.width = '70%';

    // UI表示
    renderQuestions($('#qs'));
    $('#bar').style.width = '100%';
    $('.card .title').textContent = `ようこそ、${prof.displayName} さん`;
    $('.hint').textContent = '質問に答えて「結果を見る」をタップ！';
    $('#form').style.display = '';

    // 送信
    $('#form').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const btn = $('#submit');
      btn.disabled = true; btn.textContent = '集計中…';
      await sleep(150);

      const got = collectAnswers();
      if (got.error) { alert(got.error); btn.disabled=false; btn.textContent='結果を見る'; return; }

      const result = scoreAndExplain(got.data);

      // 運営向けログ（Supabase保存用）: /api/answer へ
      const payload = {
        line_user_id: userId,
        answers: got.data,
        // result_type はシンプルに type を保存
        result_type: result.type,
      };

      let apiResp = {};
      try { apiResp = await postAnswers(payload); }
      catch(err){ apiResp = { error: String(err) }; }

      showResult(result, { payload, apiResp });
      btn.disabled = false; btn.textContent = '結果を見る';

      // 任意: トークに軽いサマリを戻す（webhookの quickReply と共存OK）
      if (liff.isInClient()) {
        try {
          await liff.shareTargetPicker?.([{
            type:'text',
            text:`診断結果：${result.type}\n合う働き方：${result.workStyle}\n職種例：${result.jobs.slice(0,3).join(' / ')}`
          }]).catch(()=>{});
        } catch {}
      }

      // 結果カードをスクロールイン
      $('#result').scrollIntoView({behavior:'smooth',block:'start'});
    });

  }catch(e){
    console.error(e);
    alert('読み込みに失敗しました。時間をおいて再度お試しください。');
  }
})();
