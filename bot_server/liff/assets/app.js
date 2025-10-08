// filename: bot_server/liff/assets/app.js
import { diagnose, quickQC } from '../../lib/scoring.js';

/* -----------------------------
 * 動的ロード
 * --------------------------- */
let QUESTIONS = null;
async function loadQuestions() {
  if (QUESTIONS) return QUESTIONS;
  const candidates = ['../../data/questions.v1.js', '/data/questions.v1.js'];
  for (const p of candidates) {
    try {
      const m = await import(/* @vite-ignore */ p);
      QUESTIONS = m.default || m.QUESTIONS || null;
      if (Array.isArray(QUESTIONS) && QUESTIONS.length) return QUESTIONS;
    } catch (e) {}
  }
  console.error('[questions] failed to load');
  return null;
}

let WEIGHTS = null;
async function loadWeights() {
  if (WEIGHTS) return WEIGHTS;
  const candidates = ['../../lib/archetype-weights.v1.json', '/lib/archetype-weights.v1.json'];
  for (const p of candidates) {
    try {
      const res = await fetch(p, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && typeof json === 'object' && Object.keys(json).length >= 12) {
        WEIGHTS = json;
        return WEIGHTS;
      }
    } catch (e) {}
  }
  console.error('[weights] failed to load');
  return null;
}

/* ----------------------------- */
window.addEventListener('DOMContentLoaded', () => mountApp());

async function mountApp() {
  const qs = await loadQuestions();
  if (!qs) {
    document.querySelector('#questions').innerHTML = `<div class="load-error">設問データ読み込み失敗</div>`;
    return;
  }
  renderSurvey(qs);
  bindSurveyHandlers();
  updateCounters();
}

/* -----------------------------
 * 設問UI（intro-sectionは破壊しない）
 * --------------------------- */
function renderSurvey(qs) {
  const mount = document.querySelector('#questions');
  const groups = chunk(qs, 10);
  const surveyPages = groups.map((g, pageIdx) => `
    <section class="page" data-page="${pageIdx + 1}">
      ${g.map(renderItem).join('')}
    </section>
  `).join('');

  mount.innerHTML = `
    <form id="survey-form">
      ${surveyPages}
    </form>
    <section class="result-card hidden" id="result"></section>
  `;
}

/* 質問項目レンダリング */
const LIKERT = [
  { value: 6, label: 'とてもそう思う' },
  { value: 5, label: 'かなりそう思う' },
  { value: 4, label: '少しそう思う' },
  { value: 3, label: '少しそう思わない' },
  { value: 2, label: 'かなりそう思わない' },
  { value: 1, label: 'まったくそう思わない' },
];

function renderItem(q) {
  const opts = LIKERT.map(o => `
    <div class="likert-choice">
      <input class="likert-input" type="radio" id="${q.id}-${o.value}" name="${q.id}" value="${o.value}" required>
      <label class="likert-option size-small" for="${q.id}-${o.value}">
        <span class="likert-diamond" aria-hidden="true"></span>
        <span class="sr-only">${o.label}</span>
      </label>
    </div>
  `).join('');

  return `
    <article class="question-card">
      <h2 class="q-text">${escapeHtml(q.text)}</h2>
      <div class="choices likert-scale">${opts}</div>
      <div class="likert-legend" aria-hidden="true">
        <span>とてもそう思う</span>
        <span class="legend-bar"></span>
        <span>まったくそう思わない</span>
      </div>
    </article>`;
}

/* -----------------------------
 * ページング処理（intro-section対応）
 * --------------------------- */
function bindSurveyHandlers() {
  const intro = document.getElementById('intro-section');
  const form = document.getElementById('survey-form');
  const pages = [...form.querySelectorAll('.page')];
  let pageIndex = 0; // 0=intro, 1〜n=設問

  const backBtn = document.getElementById('retryButton');
  const nextBtn = document.getElementById('submitButton');
  const nextLabel = document.getElementById('submitContent');

  backBtn?.addEventListener('click', e => {
    e.preventDefault();
    if (pageIndex > 0) pageIndex--;
    updatePage();
  });
  nextBtn?.addEventListener('click', e => {
    e.preventDefault();
    const isIntro = pageIndex === 0;
    const isLast = pageIndex === pages.length;
    if (isIntro) {
      if (!validateIntro()) return toast('未入力項目があります');
      pageIndex++;
    } else if (!isLast) {
      if (!validateCurrentPage()) return toast('未回答の項目があります');
      pageIndex++;
    } else {
      if (!validateAll()) return toast('未回答の項目があります');
      onSubmit();
      return;
    }
    updatePage();
  });

  form.addEventListener('change', updateCounters);

  function updatePage() {
    intro.hidden = pageIndex !== 0;
    pages.forEach((p, i) => p.hidden = i + 1 !== pageIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refreshFooter();
  }

  function refreshFooter() {
    const isFirst = pageIndex === 0;
    const isLast = pageIndex === pages.length;
    backBtn.classList.toggle('hidden', isFirst);
    nextLabel.textContent = isLast ? '結果を見る' : '次へ';
  }

  updatePage();
}

function validateIntro() {
  const selects = document.querySelectorAll('#intro-section select');
  return [...selects].every(sel => sel.value && sel.value !== '選択してください');
}

function validateCurrentPage() {
  const current = document.querySelector('.page:not([hidden])');
  const inputs = current.querySelectorAll('input[type="radio"]');
  const groups = groupBy([...inputs], el => el.name);
  return Object.values(groups).every(arr => arr.some(el => el.checked));
}

function validateAll() {
  const inputs = document.querySelectorAll('#survey-form input[type="radio"]');
  const groups = groupBy([...inputs], el => el.name);
  return Object.values(groups).every(arr => arr.some(el => el.checked));
}

/* ----------------------------- */
async function onSubmit() {
  const answers = collectAnswers();
  const weights = await loadWeights();
  const diag = diagnose(answers, { weights });
  renderResult({ diag });
}

function collectAnswers() {
  return [...document.querySelectorAll('#survey-form input[type="radio"]:checked')].map(el => ({
    id: el.name,
    value: Number(el.value),
  }));
}

/* ----------------------------- */
function renderResult({ diag }) {
  const root = document.querySelector('#result');
  root.innerHTML = `<h1>${diag.type_main}</h1>`;
  root.classList.remove('hidden');
  root.scrollIntoView({ behavior: 'smooth' });
}

/* ----------------------------- */
function chunk(arr, n) { const out = []; for (let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }
function groupBy(arr, fn) { return arr.reduce((m,x)=>{const k=fn(x);(m[k] ||= []).push(x);return m;},{}); }
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));}
function toast(msg){let t=document.querySelector('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1600);}
