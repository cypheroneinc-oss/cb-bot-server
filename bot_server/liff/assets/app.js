// filename: bot_server/liff/assets/app.js
import { diagnose, quickQC } from '../../lib/scoring.js';

/* -----------------------------
 * データの動的ロード
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

/* -----------------------------
 * LIFF placeholders（必要なら使う）
 * --------------------------- */
const LIFF_ID = resolveLiffId();
const BASE_URL = resolveBaseUrl();
const QUESTION_VERSION = 'v1';

/* -----------------------------
 * 6法同意ラベル
 * --------------------------- */
const LIKERT_OPTIONS = [
  { value: 6, label: 'とてもそう思う' },
  { value: 5, label: 'かなりそう思う' },
  { value: 4, label: '少しそう思う' },
  { value: 3, label: '少しそう思わない' },
  { value: 2, label: 'かなりそう思わない' },
  { value: 1, label: 'まったくそう思わない' },
];

/* -----------------------------
 * エントリポイント
 * --------------------------- */
window.addEventListener('DOMContentLoaded', () => { mountApp(); });

async function mountApp() {
  const app = document.querySelector('#questions'); // ← index.htmlの既存要素
  if (!app) { console.error('[app] #questions not found'); return; }

  const qs = await loadQuestions();
  if (!qs) {
    app.innerHTML = `<div class="load-error">設問データの読み込みに失敗しました。/data/questions.v1.js の配置とパスを確認してください。</div>`;
    return;
  }

  app.innerHTML = renderSurvey(qs);
  bindSurveyHandlers();
  updateCounters(); // 初期化
  wireFooterSubmit(); // フッターの「送信する」ボタンも使えるように
}

/* -----------------------------
 * Survey UI（設問本体だけ描画）
 * --------------------------- */
function renderSurvey(qs) {
  const groups = chunk(qs, 10); // 10問ごとページング
  const pagesHtml = groups.map((qs, i) => `
    <section class="page" data-page="${i}">
      ${qs.map(renderItem).join('')}
      <div class="page-actions">
        ${i > 0 ? '<button class="btn prev">戻る</button>' : ''}
        ${i < groups.length - 1
          ? '<button class="btn next">次へ</button>'
          : '<button class="btn submit primary">結果を見る</button>'}
      </div>
    </section>
  `).join('');

  // ヘッダ/フッタは index.html 側のものを使うため、ここではボディのみ返す
  return `
    <form id="survey-form" aria-live="polite">
      ${pagesHtml}
    </form>
    <div id="result" class="result" hidden></div>
  `;
}

function renderItem(q) {
  const opts = LIKERT_OPTIONS.map(o => `
    <label class="likert-option">
      <input type="radio" name="${q.id}" value="${o.value}" required>
      <span>${o.label}</span>
    </label>
  `).join('');

  return `
    <div class="q" data-id="${q.id}">
      <div class="q-text">${escapeHtml(q.text)}</div>
      <div class="likert">${opts}</div>
    </div>
  `;
}

/* -----------------------------
 * ハンドラ
 * --------------------------- */
function bindSurveyHandlers() {
  const form = document.querySelector('#survey-form');
  const pages = [...form.querySelectorAll('.page')];
  let pageIndex = 0; updatePage();

  // ページングボタン
  form.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    e.preventDefault();

    if (target.classList.contains('next')) { if (validatePage()) { pageIndex++; updatePage(); } }
    if (target.classList.contains('prev')) { pageIndex = Math.max(0, pageIndex - 1); updatePage(); }
    if (target.classList.contains('submit')) { if (validateAll()) onSubmit(); }
  });

  // 回答が変わったらカウンタとプログレス更新
  form.addEventListener('change', updateCounters);

  function updatePage() {
    pages.forEach((p, i) => p.hidden = i !== pageIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateCounters();
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

// フッターの「送信する」ボタンも使えるよう配線
function wireFooterSubmit() {
  const footerBtn = document.getElementById('submitButton');
  if (!footerBtn) return;
  footerBtn.disabled = false;
  footerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const ok = (() => {
      const form = document.querySelector('#survey-form');
      const inputs = form.querySelectorAll('input[type="radio"]');
      const groups = groupBy([...inputs], el => el.name);
      return Object.values(groups).every(arr => arr.some(el => el.checked));
    })();
    if (!ok) return toast('未回答の項目があります');
    onSubmit();
  });
}

async function onSubmit() {
  const answers = collectAnswers();
  const qc = quickQC(answers);
  const weights = await loadWeights();
  if (!weights) { toast('重みデータの読み込みに失敗しました'); return; }
  const diag = diagnose(answers, { weights });
  renderResult({ diag, qc });
  // 必要なら保存APIへ送る:
  // await fetch(BASE_URL + '/api/diagnosis/submit', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ answers, diag, qc, ver: QUESTION_VERSION }) });
}

function collectAnswers() {
  const inputs = document.querySelectorAll('#survey-form input[type="radio"]:checked');
  return [...inputs].map(el => ({ id: el.name, value: Number(el.value) }));
}

/* -----------------------------
 * 結果UI
 * --------------------------- */
function renderResult({ diag /*, qc */ }) {
  const root = document.querySelector('#result');
  const { type_main, type_sub, confidence, balanceIndex, prob, vec } = diag;

  const probList = Object.entries(prob)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 5)
    .map(([k,v]) => `<li><span class="t">${k}</span><span class="v">${(v*100).toFixed(1)}%</span></li>`)
    .join('');

  const dials = pickFactorDials(vec);

  root.innerHTML = `
    <div class="result-head">
      <h2>あなたのタイプ</h2>
      <div class="type-main"><span class="badge">主</span><strong>${type_main}</strong></div>
      ${type_sub ? `<div class="type-sub"><span class="badge">サブ</span><strong>${type_sub}</strong></div>` : ''}
      <div class="meta">
        <span>信頼度: ${(confidence*100).toFixed(0)}%</span>
        <span>二相指数: ${(balanceIndex*100).toFixed(0)}%</span>
      </div>
    </div>
    <section class="dials">${dials.map(renderDial).join('')}</section>
    <section class="prob"><h3>近接タイプ（上位5）</h3><ul class="prob-list">${probList}</ul></section>
    <section class="cta">
      <button class="btn restart">もう一度やる</button>
      <button class="btn share">結果をシェア</button>
    </section>
  `;

  root.hidden = false;
  root.scrollIntoView({ behavior: 'smooth' });

  root.querySelector('.restart')?.addEventListener('click', () => location.reload());
  root.querySelector('.share')?.addEventListener('click', () => shareResult(type_main, type_sub, confidence));
}

/* -----------------------------
 * 進捗カウンタ／ダイヤル
 * --------------------------- */
function updateCounters() {
  const form = document.getElementById('survey-form');
  if (!form) return;
  const answered = form.querySelectorAll('input[type="radio"]:checked').length;
  const total = form.querySelectorAll('.q').length;
  const rem = Math.max(0, total - answered);

  const ac = document.getElementById('answeredCount');
  const rc = document.getElementById('remainingCount');
  if (ac) ac.innerText = String(answered);
  if (rc) rc.innerText = String(rem);

  const bar = document.getElementById('progressFill');
  if (bar) bar.style.width = `${Math.round((answered / Math.max(total,1)) * 100)}%`;
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
 * 共有
 * --------------------------- */
function shareResult(typeMain, typeSub, conf) {
  const text = `私のアーキタイプは「${typeMain}」${typeSub ? `（サブ: ${typeSub}）` : ''}。信頼度${(conf*100).toFixed(0)}%`;
  if (navigator.share) navigator.share({ text }).catch(() => copyToClipboard(text));
  else copyToClipboard(text);
  toast('結果テキストを共有しました');
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
function resolveLiffId() { const meta = document.querySelector('meta[name="liff-id"]'); return (meta && meta.content) || (window.__LIFF_ID__ || ''); }
function resolveBaseUrl() { const meta = document.querySelector('meta[name="app-base-url"]'); return (meta && meta.content) || (window.__BASE_URL__ || ''); }
