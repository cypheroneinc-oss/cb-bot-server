// filename: bot_server/liff/assets/app.js（Cロジック診断 配線済み・完全版）
// 依存: ../../data/questions.v1.js, ../../lib/scoring.js, ../../lib/archetype-weights.v1.json
// 目的: 36問の回答収集 → Cロジック診断 → 12タイプ出力（主/サブ＋根拠ダイヤル）

// 動的ロード（ビルド環境差異に強くする）
import { diagnose, quickQC } from '../../lib/scoring.js';
let QUESTIONS = null;
async function loadQuestions() {
  if (QUESTIONS) return QUESTIONS;
  // 相対パス候補を順に試す
  const candidates = [
    '../../data/questions.v1.js',
    '/data/questions.v1.js',
  ];
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

// ====== LIFF設定（既存実装を尊重。必要に応じて置換可） ======
const LIFF_ID = resolveLiffId();
const BASE_URL = resolveBaseUrl();
const QUESTION_VERSION = 'v1';

// 6法同意のラベル（UIは既存のコンポーネントを再利用）
const LIKERT_OPTIONS = [
  { value: 6, label: 'とてもそう思う' },
  { value: 5, label: 'かなりそう思う' },
  { value: 4, label: '少しそう思う' },
  { value: 3, label: '少しそう思わない' },
  { value: 2, label: 'かなりそう思わない' },
  { value: 1, label: 'まったくそう思わない' },
];

// ====== エントリポイント ======
window.addEventListener('DOMContentLoaded', () => { mountApp(); });

async function mountApp() {
  const app = document.querySelector('#app');
  if (!app) { console.error('[app] #app not found'); return; }

  const qs = await loadQuestions();
  if (!qs) {
    app.innerHTML = `<div class="fatal">設問データの読み込みに失敗しました。/data/questions.v1.js の配置とパスを確認してください。</div>`;
    return;
  }

  // レンダリング
  app.innerHTML = renderSurvey(qs);

  // イベント配線
  bindSurveyHandlers();
}

// ====== Survey UI ======
function renderSurvey(qs) {
  const groups = chunk(qs, 10); // 10問ごとに区切る（UX安定）

  const pagesHtml = groups.map((qs, i) => `
    <section class="page" data-page="${i}">
      ${qs.map(renderItem).join('')}
      <div class="page-actions">
        ${i > 0 ? '<button class="btn prev">戻る</button>' : ''}
        ${i < groups.length - 1 ? '<button class="btn next">次へ</button>' : '<button class="btn submit primary">結果を見る</button>'}
      </div>
    </section>
  `).join('');

  return `
    <div class="survey">
      <header class="survey-head">
        <h1>働き方アーキタイプ診断</h1>
        <p class="desc">直感で答えてOK。合計36問、約4分で終わる。</p>
      </header>
      <form id="survey-form">
        ${pagesHtml}
      </form>
      <div id="result" class="result" hidden></div>
    </div>
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

function bindSurveyHandlers() {
  const form = document.querySelector('#survey-form');
  const pages = [...form.querySelectorAll('.page')];
  let pageIndex = 0; updatePage();

  form.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    e.preventDefault();

    if (target.classList.contains('next')) { if (validatePage()) { pageIndex++; updatePage(); } }
    if (target.classList.contains('prev')) { pageIndex = Math.max(0, pageIndex - 1); updatePage(); }
    if (target.classList.contains('submit')) { if (validateAll()) onSubmit(); }
  });

  function updatePage() {
    pages.forEach((p, i) => p.hidden = i !== pageIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

async function onSubmit() {
  const answers = collectAnswers();
  const qc = quickQC(answers);
  const diag = diagnose(answers);
  renderResult({ diag, qc });
  // 送信保存が必要ならここで fetch(BASE_URL + '/api/diagnosis/submit', ...) を実行
}

function collectAnswers() {
  const inputs = document.querySelectorAll('#survey-form input[type="radio"]:checked');
  const ans = [...inputs].map(el => ({ id: el.name, value: Number(el.value) }));
  return ans;
}

// ====== Result UI ======
function renderResult({ diag, qc }) {
  const root = document.querySelector('#result');
  const { type_main, type_sub, confidence, balanceIndex, prob, vec, sub, norm } = diag;

  const probList = Object.entries(prob)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 5)
    .map(([k,v]) => `<li><span class="t">${k}</span><span class="v">${(v*100).toFixed(1)}%</span></li>`) 
    .join('');

  // 因子ダイヤル（主要10キーを抜粋表示）
  const dials = pickFactorDials(diag.vec);

  root.innerHTML = `
    <div class="result-head">
      <h2>あなたのタイプ</h2>
      <div class="type-main">
        <span class="badge">主</span>
        <strong>${type_main}</strong>
      </div>
      ${type_sub ? `<div class="type-sub"><span class="badge">サブ</span><strong>${type_sub}</strong></div>` : ''}
      <div class="meta">
        <span>信頼度: ${(confidence*100).toFixed(0)}%</span>
        <span>二相指数: ${(balanceIndex*100).toFixed(0)}%</span>
      </div>
    </div>

    <section class="dials">
      ${dials.map(renderDial).join('')}
    </section>

    <section class="prob">
      <h3>近接タイプ（上位5）</h3>
      <ul class="prob-list">${probList}</ul>
    </section>

    <section class="cta">
      <button class="btn restart">もう一度やる</button>
      <button class="btn share">結果をシェア</button>
    </section>
  `;

  root.hidden = false;
  document.querySelector('.survey').scrollIntoView({ behavior: 'smooth' });

  root.querySelector('.restart')?.addEventListener('click', () => location.reload());
  root.querySelector('.share')?.addEventListener('click', () => shareResult(type_main, type_sub, confidence));
}

function pickFactorDials(vec25) {
  // 表示する10キー（UI簡潔化）
  const keys = [
    'Trait.Extraversion','Trait.Conscientiousness','Trait.Openness','Trait.Agreeableness','Trait.Neuroticism',
    'Orientation.Promotion','Orientation.Prevention',
    'Value.Achievement','Value.Autonomy','Value.Security'
  ];
  return keys.map(k => ({ key: k, label: prettyLabel(k), value: Math.round((vec25[k] ?? 0.5)*100) }));
}

function renderDial({ key, label, value }) {
  return `
    <div class="dial">
      <div class="dial-head">
        <span class="label">${label}</span>
        <span class="num">${value}</span>
      </div>
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

function shareResult(typeMain, typeSub, conf) {
  const text = `私のアーキタイプは「${typeMain}」${typeSub ? `（サブ: ${typeSub}）` : ''}。信頼度${(conf*100).toFixed(0)}%`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => copyToClipboard(text));
  } else {
    copyToClipboard(text);
  }
  toast('結果テキストを共有しました');
}

// ====== helpers ======
function chunk(arr, n) { const out = []; for (let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }
function groupBy(arr, keyFn) { return arr.reduce((m, x) => { const k = keyFn(x); (m[k] ||= []).push(x); return m; }, {}); }
function escapeHtml(s='') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
function copyToClipboard(text) { navigator.clipboard?.writeText(text).catch(()=>{}); }
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

// ====== 既存のplaceholders ======
function resolveLiffId() {
  const meta = document.querySelector('meta[name="liff-id"]');
  return (meta && meta.content) || (window.__LIFF_ID__ || '');
}
function resolveBaseUrl() {
  const meta = document.querySelector('meta[name="app-base-url"]');
  return (meta && meta.content) || (window.__BASE_URL__ || '');
}
