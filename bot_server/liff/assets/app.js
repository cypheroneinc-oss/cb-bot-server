// filename: bot_server/liff/assets/app.js
import { diagnose, quickQC } from '../../lib/scoring.js';

/* -----------------------------
 * 動的ロード
 * --------------------------- */
let QUESTIONS = null;
async function loadQuestions() {
  if (QUESTIONS) return QUESTIONS;
  const candidates = ['../../data/questions.v1.js', '/data/questions.v1.js'];
  let lastErr;
  for (const p of candidates) {
    try {
      const m = await import(/* @vite-ignore */ p);
      QUESTIONS = m.default || m.QUESTIONS || null;
      if (Array.isArray(QUESTIONS) && QUESTIONS.length) return QUESTIONS;
    } catch (e) { lastErr = e; }
  }
  console.error('[questions] failed to load', lastErr);
  return null;
}

let WEIGHTS = null;
async function loadWeights() {
  if (WEIGHTS) return WEIGHTS;
  const candidates = ['../../lib/archetype-weights.v1.json', '/lib/archetype-weights.v1.json'];
  let lastErr;
  for (const p of candidates) {
    try {
      const res = await fetch(p, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && typeof json === 'object' && Object.keys(json).length >= 12) {
        WEIGHTS = json;
        return WEIGHTS;
      }
    } catch (e) { lastErr = e; }
  }
  console.error('[weights] failed to load', lastErr);
  return null;
}

/* ----------------------------- */
const QUESTION_VERSION = 'v1';

/* 6件法（左：とてもそう思う → 右：まったくそう思わない） */
const LIKERT_REVERSED = [
  { value: 6, label: 'とてもそう思う' },
  { value: 5, label: 'かなりそう思う' },
  { value: 4, label: '少しそう思う' },
  { value: 3, label: '少しそう思わない' },
  { value: 2, label: 'かなりそう思わない' },
  { value: 1, label: 'まったくそう思わない' },
];

/* ----------------------------- */
window.addEventListener('DOMContentLoaded', () => { mountApp(); });

async function mountApp() {
  const mount = document.querySelector('#questions'); // index.html 側の領域
  if (!mount) { console.error('[app] #questions not found'); return; }

  const qs = await loadQuestions();
  if (!qs) {
    mount.innerHTML = `<div class="load-error">設問データの読み込みに失敗しました。/data/questions.v1.js を確認してください。</div>`;
    return;
  }

  mount.innerHTML = renderSurvey(qs);
  bindSurveyHandlers();
  updateCounters();
  wireFooterSubmit();
}

/* -----------------------------
 * 設問UI（CSSに合わせたマークアップ）
 * --------------------------- */
function renderSurvey(qs) {
  const groups = chunk(qs, 10);
  const pagesHtml = groups.map((g, pageIdx) => `
    <section class="page" data-page="${pageIdx}">
      ${g.map(renderItem).join('')}
      <div class="page-actions">
        ${pageIdx > 0 ? '<button class="btn prev" type="button">戻る</button>' : ''}
        ${pageIdx < groups.length - 1 ? '<button class="btn next primary" type="button">次へ</button>' : ''}
      </div>
    </section>
  `).join('');

  return `
    <form id="survey-form" aria-live="polite">
      ${pagesHtml}
    </form>
    <section class="result-card hidden" id="result"></section>
  `;
}

/* 1問のカード（ひし形下の可視ラベルは削除／sr-onlyのみ） */
function renderItem(q) {
  const name = q.id;
  const opts = LIKERT_REVERSED.map((o) => {
    const id = `${name}-${o.value}`;
    return `
      <div class="likert-choice">
        <input class="likert-input" type="radio" id="${id}" name="${name}" value="${o.value}" required>
        <label class="likert-option size-small" for="${id}">
          <span class="likert-diamond" aria-hidden="true"></span>
          <span class="sr-only">${o.label}</span>
        </label>
      </div>
    `;
  }).join('');

  return `
    <article class="question-card">
      <h2 class="q-text">${escapeHtml(q.text)}</h2>
      <div class="choices likert-scale">
        ${opts}
      </div>
      <div class="likert-legend" aria-hidden="true">
        <span>とてもそう思う</span>
        <span class="legend-bar"></span>
        <span>まったくそう思わない</span>
      </div>
    </article>
  `;
}

/* -----------------------------
 * 入力・ページング・検証
 * --------------------------- */
function bindSurveyHandlers() {
  const form = document.querySelector('#survey-form');
  const pages = [...form.querySelectorAll('.page')];
  let pageIndex = 0;
  updatePage();

  form.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    e.preventDefault();

    if (btn.classList.contains('next')) {
      if (validatePage()) {
        pageIndex = Math.min(pages.length - 1, pageIndex + 1);
        updatePage();
      }
    }
    if (btn.classList.contains('prev')) {
      pageIndex = Math.max(0, pageIndex - 1);
      updatePage();
    }
  });

  form.addEventListener('change', updateCounters);

  function updatePage() {
    pages.forEach((p, i) => (p.hidden = i !== pageIndex));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateCounters();
    toggleFooter(pageIndex === pages.length - 1); // ★ 最終ページだけ送信ボタンを表示
  }

  function validatePage() {
    const current = pages[pageIndex];
    const inputs = current.querySelectorAll('input[type="radio"]');
    const groups = groupBy([...inputs], el => el.name);
    const valid = Object.values(groups).every(arr => arr.some(el => el.checked));
    if (!valid) toast('未回答の項目があります');
    return valid;
  }

  function validateAll() {
    const inputs = form.querySelectorAll('input[type="radio"]');
    const groups = groupBy([...inputs], el => el.name);
    const valid = Object.values(groups).every(arr => arr.some(el => el.checked));
    if (!valid) toast('未回答の項目があります');
    return valid;
  }
}

/* フッターの送信ボタンを配線（最終ページのみ表示） */
function wireFooterSubmit() {
  const btn = document.getElementById('submitButton');
  if (!btn) return;

  // 初期は非表示・無効
  btn.classList.add('hidden');
  btn.disabled = true;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const form = document.querySelector('#survey-form');
    if (!form) return;
    const inputs = form.querySelectorAll('input[type="radio"]');
    const groups = groupBy([...inputs], el => el.name);
    const ok = Object.values(groups).every(arr => arr.some(el => el.checked));
    if (!ok) return toast('未回答の項目があります');
    onSubmit();
  });
}

/* 最終ページだけ送信ボタンを出して有効化 */
function toggleFooter(isLastPage) {
  const btn = document.getElementById('submitButton');
  if (!btn) return;
  if (isLastPage) {
    btn.classList.remove('hidden');
    btn.disabled = false;
    document.getElementById('resultActions')?.classList.add('hidden');
  } else {
    btn.classList.add('hidden');
    btn.disabled = true;
  }
}

/* -----------------------------
 * 診断と結果
 * --------------------------- */
async function onSubmit() {
  const answers = collectAnswers();
  const qc = quickQC(answers);
  const weights = await loadWeights();
  if (!weights) { toast('重みデータの読み込みに失敗しました'); return; }

  const diag = diagnose(answers, { weights });
  renderResult({ diag, qc });
  // 保存するならここでfetch
}

function collectAnswers() {
  const inputs = document.querySelectorAll('#survey-form input[type="radio"]:checked');
  return [...inputs].map(el => ({ id: el.name, value: Number(el.value) }));
}

function renderResult({ diag /*, qc*/ }) {
  const root = document.querySelector('#result');
  const { type_main, type_sub, confidence, balanceIndex, prob, vec } = diag;

  const probList = Object.entries(prob)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 5)
    .map(([k,v]) => `<li><span class="t">${k}</span><span class="v">${(v*100).toFixed(1)}%</span></li>`)
    .join('');

  const dials = pickFactorDials(vec);

  root.innerHTML = `
    <header class="result-header">
      <h1>診断が完了したよ</h1>
      <p id="resultSub">信頼度 ${(confidence*100).toFixed(0)}%／二相指数 ${(balanceIndex*100).toFixed(0)}%</p>
    </header>

    <div class="hero-card">
      <div class="hero-avatar"><img id="resultHeroImage" alt=""></div>
      <div class="hero-details">
        <span class="cluster-tag">上位タイプ</span>
        <h2 id="resultHeroName">${type_main}${type_sub ? `（サブ: ${type_sub}）` : ''}</h2>
      </div>
    </div>

    <section class="dials">
      ${dials.map(renderDial).join('')}
    </section>

    <section class="prob">
      <h3>近接タイプ（上位5）</h3>
      <ul class="prob-list">${probList}</ul>
    </section>

    <div class="share-actions">
      <h3>シェアする</h3>
      <div class="share-buttons">
        <button type="button" class="share-btn" id="shareWebButton">端末でシェア</button>
        <button type="button" class="share-btn" id="shareCopyButton">リンクをコピー</button>
      </div>
    </div>
  `;

  root.classList.remove('hidden');
  root.scrollIntoView({ behavior: 'smooth' });

  document.getElementById('shareWebButton')?.addEventListener('click', () => {
    const text = `私のアーキタイプは「${type_main}」${type_sub ? `（サブ: ${type_sub}）` : ''}。信頼度${(confidence*100).toFixed(0)}%`;
    if (navigator.share) navigator.share({ text }).catch(() => copyToClipboard(text));
    else copyToClipboard(text);
    toast('結果テキストを共有しました');
  });
  document.getElementById('shareCopyButton')?.addEventListener('click', () => {
    const url = location.href;
    copyToClipboard(url);
    toast('リンクをコピーしました');
  });
}

/* -----------------------------
 * 進捗/ダイヤル
 * --------------------------- */
function updateCounters() {
  const form = document.getElementById('survey-form');
  if (!form) return;
  const answered = form.querySelectorAll('input[type="radio"]:checked').length;
  const total = form.querySelectorAll('.question-card .likert-input').length / 6; // 1問=6択
  const rem = Math.max(0, total - answered);

  document.getElementById('answeredCount')?.replaceChildren(document.createTextNode(String(answered)));
  document.getElementById('remainingCount')?.replaceChildren(document.createTextNode(String(rem)));

  const bar = document.getElementById('progressFill');
  if (bar) bar.style.width = `${Math.round((answered / Math.max(total, 1)) * 100)}%`;
}

function pickFactorDials(vec25) {
  const keys = [
    'Trait.Extraversion','Trait.Conscientiousness','Trait.Openness','Trait.Agreeableness','Trait.Neuroticism',
    'Orientation.Promotion','Orientation.Prevention',
    'Value.Achievement','Value.Autonomy','Value.Security'
  ];
  return keys.map(k => ({ key: k, label: prettyLabel(k), value: Math.round((vec25[k] ?? 0.5)*100) }));
}

function renderDial({ label, value }) {
  return `
    <div class="dial">
      <div class="dial-head"><span class="label">${label}</span><span class="num">${value}</span></div>
      <div class="bar"><span style="width:${value}%"></span></div>
    </div>
  `;
}

function prettyLabel(key) {
  const map = {
    'Trait.Extraversion': '外向性',
    'Trait.Conscientiousness': '誠実性',
    'Trait.Openness': '開放性',
    'Trait.Agreeableness': '協調性',
    'Trait.Neuroticism': '安定性',
    'Orientation.Promotion': '促進志向',
    'Orientation.Prevention': '予防志向',
    'Value.Achievement': '達成価値',
    'Value.Autonomy': '自律価値',
    'Value.Security': '安定価値',
  };
  return map[key] || key;
}

/* -----------------------------
 * helpers
 * --------------------------- */
function chunk(arr, n) { const out = []; for (let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }
function groupBy(arr, keyFn) { return arr.reduce((m, x) => { const k = keyFn(x); (m[k] ||= []).push(x); return m; }, {}); }
function escapeHtml(s = "") {
  return String(s)
    .replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
}
function copyToClipboard(text) { navigator.clipboard?.writeText(text).catch(()=>{}); }
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}
