// filename: bot_server/liff/assets/app.js
// ⬇️ 変更点：legacy diagnose() → v3のscore()に切替。結果の名前はdiag.archetype.labelを優先。
//           重みの事前fetch依存は外し、API失敗時もローカルv3結果を表示できるように。

import { quickQC } from '../../lib/scoring.js'; // quickQCはそのまま利用
import { score } from '../../lib/scoring/index.js'; // ★ v3スコアラを含むscore()を使用
import { getHeroNarrative } from '../../lib/result-content.js';

let QUESTIONS = null;
async function loadQuestions() {
  if (QUESTIONS) return QUESTIONS;
  const candidates = [
    '../../data/questions.v3.js', '/data/questions.v3.js',
    '../../data/questions.v1.js', '/data/questions.v1.js' // フォールバック
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
  const mount = document.querySelector('#questions');
  if (mount) {
    mount.innerHTML = `<div class="load-error">設問データの読み込みに失敗しました。/data/questions.v3.js を確認してください。</div>`;
  }
  return null;
}

// 旧：WEIGHTS ローダは未使用化（v3スコアラが内部で重みモジュールをimportするため）

const QUESTION_VERSION = 'v3';

const LIKERT_REVERSED = [
  { value: 6, label: 'とてもそう思う' },
  { value: 5, label: 'かなりそう思う' },
  { value: 4, label: '少しそう思う' },
  { value: 3, label: '少しそう思わない' },
  { value: 2, label: 'かなりそう思わない' },
  { value: 1, label: 'まったくそう思わない' },
];

window.addEventListener('DOMContentLoaded', () => { mountApp(); });

async function mountApp() {
  const mount = document.querySelector('#questions');
  if (!mount) { console.error('[app] #questions not found'); return; }

  const qs = await loadQuestions();
  if (!qs) return;

  mount.innerHTML = renderSurvey(qs);
  wireFooterSubmit();
  initDemographics();
  bindSinglePageHandlers();
  updateCounters();

  const submitBtn = document.getElementById('submitButton');
  if (submitBtn && !submitBtn.dataset.bound) {
    submitBtn.dataset.bound = '1';
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!validateAll()) { toast('未回答の項目があります'); return; }
      onSubmit();
    });
  }

  const progressBar = document.querySelector('.progress-bar');
  const statusText = document.querySelector('.status');
  const subtitle = document.querySelector('.subtitle');
  if (progressBar) progressBar.remove();
  if (statusText) statusText.remove();
  if (subtitle) subtitle.remove();
}

function renderSurvey(qs) {
  const itemsHtml = qs.map(renderItem).join('');
  return `
    <form id="survey-form" aria-live="polite">
      <section class="page" data-page="0">
        ${itemsHtml}
      </section>
    </form>
    <section class="result-card hidden" id="result"></section>
  `;
}

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

function bindSinglePageHandlers() {
  const form = document.querySelector('#survey-form');
  const submitBtn = document.getElementById('submitButton');
  const submitLabel = document.getElementById('submitContent');
  const backBtn = document.getElementById('retryButton');

  backBtn?.classList.add('hidden');
  if (submitLabel) submitLabel.textContent = '結果を見る';

  form.addEventListener('change', () => {
    updateCounters();
    submitBtn.disabled = !validateAll();
  });

  submitBtn.disabled = !validateAll();
}

function wireFooterSubmit() {
  const btn = document.getElementById('submitButton');
  if (!btn) return;
  btn.classList.remove('hidden');
  btn.disabled = true;
  btn.onclick = (e) => {
    e.preventDefault();
    if (!validateAll()) { toast('未回答の項目があります'); return; }
    onSubmit();
  };
}

/* -----------------------------
 * 診断と結果
 * --------------------------- */
async function onSubmit() {
  const answers = collectAnswers();
  const qc = quickQC(answers);

  // ★ ローカル推定は v3 スコアラで実施（API失敗時のフォールバック担保）
  let diag = null;
  try {
    diag = score(answers, 'v3'); // v3直通（重みはv3スコアラが内部import）
  } catch (e) {
    console.warn('[local score] failed:', e?.message || e);
  }

  // API送信（失敗しても続行）
  let api = null;
  try {
    api = await submitToApi(answers);
  } catch (e) {
    console.warn('[app] submitToApi failed:', e?.message || e);
  }

  renderResult({ diag, qc, api });
}

function collectAnswers() {
  const inputs = document.querySelectorAll('#survey-form input[type="radio"]:checked');
  return [...inputs].map(el => ({ id: el.name, value: Number(el.value) }));
}

async function submitToApi(localAnswers) {
  const base = resolveBaseUrl();
  const url = `${base}/api/diagnosis/submit`;

  const userId = getOrCreateUserId();

  const selGender = document.getElementById('demographicsGender');
  const selAge    = document.getElementById('demographicsAge');
  const selMbti   = document.getElementById('demographicsMbti');

  const payload = {
    userId,
    version: QUESTION_VERSION, // 'v3'
    answers: localAnswers.map(a => ({
      questionId: a.id,
      scale: a.value,
      scaleMax: 6,
      choiceId: a.value >= 4 ? 'POS' : 'NEG',
    })),
    meta: {
      demographics: {
        gender: selGender?.value || '',
        age: selAge?.value || '',
        mbti: selMbti?.value || '',
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const t = await res.text();
      if (t) msg += `: ${t.slice(0, 300)}`;
    } catch(_) {}
    console.error('[submitToApi] failed:', msg);
    throw new Error(msg);
  }
  return await res.json();
}

/* -----------------------------
 * 結果描画（v3フォールバック強化）
 * --------------------------- */
function renderResult({ diag /*, qc*/, api }) {
  window.__DBG = { api, diag };
  console.log('[DEBUG api]', api && JSON.stringify(api).slice(0, 1000));
  console.log('[DEBUG diag]', diag);

  const root = document.getElementById('resultCard') || document.querySelector('#result');
  if (!root) { console.error('[result] container not found'); return; }

  // ★ v3優先：APIがなければローカルdiagのarchetype.labelを使う
  const mainName = api?.hero?.name
    || diag?.archetype?.label
    || '';

  const subName = ''; // v3はsub型の概念なし（必要ならidealTop3等で補助表示）

  const apiData = deepExtractNarrativeFromApi(api);

  let data = apiData;
  if (!hasAnyContent(data)) {
    const cleanName = String(mainName).replace(/（.*?）/g, '').trim();
    const slug = api?.hero?.slug ? String(api.hero.slug).trim() : '';
    const baseCandidates = [cleanName, mainName, slug].filter(Boolean);
    const expandVariants = (k) => {
      const s = String(k || '').trim();
      if (!s) return [];
      const base = s.replace(/[()（）]/g, '').trim();
      const lower = base.toLowerCase();
      const kebab = lower.split(' ').filter(Boolean).join('-');
      const noSpace = lower.split(' ').join('');
      return [base, lower, kebab, noSpace];
    };
    const allKeys = Array.from(new Set(baseCandidates.flatMap(expandVariants)));
    for (const key of allKeys) { const hit = getHeroNarrative(key); if (hasAnyContent(hit)) { data = hit; break; } }
    if (!hasAnyContent(data)) data = {};
  }

  const heroNameEl = root.querySelector('#resultHeroName');
  const clusterTag = root.querySelector('#resultClusterTag');
  const resultSub  = root.querySelector('#resultSub');
  if (heroNameEl) heroNameEl.textContent = `${mainName}${subName}`;
  if (clusterTag) clusterTag.textContent = '上位タイプ';
  if (resultSub)  resultSub.textContent  = '';

  setHTML(findOrCreateSection(root, ['#resultEngineBody', '#resultPersonalityBody'], '❤️ 心のエンジン', 'div', 'result-paragraphs'), asParas(data?.engine));
  setHTML(findOrCreateSection(root, ['#resultFearBody'], '😨 いちばん怖いこと', 'div', 'result-paragraphs'), asParas(data?.fear));
  setHTML(findOrCreateSection(root, ['#resultPerceptionBody'], '👀 こう見られがち', 'div', 'result-paragraphs'), asParas(data?.perception));
  setList(findOrCreateSection(root, ['#resultScenes'], '⚡ 活躍シーン', 'ul'), data?.scenes);
  setList(findOrCreateSection(root, ['#resultGrowth', '#resultTips'], '🌱 伸ばし方', 'ul'), data?.growth);
  setList(findOrCreateSection(root, ['#resultReactions'], '🧪 化学反応', 'ol'), data?.reaction, { ordered: true });

  const img = root.querySelector('#resultHeroImage');
  if (img && api?.hero?.avatarUrl) img.src = api.hero.avatarUrl;

  root.classList.remove('hidden');
  root.scrollIntoView({ behavior: 'smooth' });

  const backBtn = document.getElementById('retryButton');
  const nextBtn = document.getElementById('submitButton');
  if (backBtn) {
    backBtn.classList.remove('hidden');
    backBtn.textContent = 'もう一度診断する';
    backBtn.onclick = () => location.reload();
  }
  nextBtn?.classList.add('hidden');
}

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

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function copyToClipboard(text) { navigator.clipboard?.writeText(text).catch(()=>{}); }
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

function resolveBaseUrl(){
  const meta = document.querySelector('meta[name="app-base-url"]')?.content?.trim();
  if (meta) return meta.replace(/\/$/,'');
  const env = window?.__APP_BASE_URL__ || '';
  if (env) return String(env).replace(/\/$/,'');
  return '';
}

function getOrCreateUserId(){
  const key = 'cb_user_id';
  let v = localStorage.getItem(key);
  if (!v) { v = crypto?.randomUUID?.() || `anon-${Date.now()}`; localStorage.setItem(key, v); }
  return v;
}

function setHTML(elOrSel, htmlOrText) {
  const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
  if (!el) return;
  if (typeof htmlOrText === 'string') {
    el.innerHTML = htmlOrText;
  } else {
    el.textContent = String(htmlOrText ?? '');
  }
}
function asParas(text) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (trimmed.startsWith('<')) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map(t => `<p>${escapeHtml(t.trim())}</p>`)
    .join('');
}
function setList(elOrSel, value, { ordered = false } = {}) {
  const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
  if (!el) return;
  if (typeof value === 'string' && value.trim().startsWith('<')) {
    el.innerHTML = value; return;
  }
  const arr = Array.isArray(value) ? value : (value ? [value] : []);
  const items = arr.map(x => `<li>${escapeHtml(String(x))}</li>`).join('');
  el.innerHTML = ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
}

function findOrCreateSection(root, selectors, headingText, tag = 'div', className = '') {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  const hs = [...root.querySelectorAll('h3')];
  const h = hs.find(x => x.textContent.trim().replace(/\s+/g,'') === headingText.replace(/\s+/g,''));
  const container = document.createElement(tag);
  if (className) container.className = className;
  if (h && h.parentNode) {
    h.parentNode.insertBefore(container, h.nextSibling);
  } else {
    root.appendChild(container);
  }
  return container;
}

function deepExtractNarrativeFromApi(api) {
  if (!api || typeof api !== 'object') return null;

  const out = { engine: null, fear: null, perception: null, scenes: null, growth: null, reaction: null };

  const titleToKey = (titleRaw = '') => {
    const t = String(titleRaw).replace(/\s+/g,'').toLowerCase();
    if (t.includes('心のエンジン') || t.includes('個性') || t.includes('personality') || t.includes('core')) return 'engine';
    if (t.includes('怖') || t.includes('いちばん怖いこと') || t.includes('fear') || t.includes('risk')) return 'fear';
    if (t.includes('見られがち') || t.includes('見え方') || t.includes('perception') || t.includes('image')) return 'perception';
    if (t.includes('活躍シーン') || t.includes('シーン') || t.includes('scenes') || t.includes('situations')) return 'scenes';
    if (t.includes('伸ばし方') || t.includes('成長') || t.includes('tips') || t.includes('advice') || t.includes('growth')) return 'growth';
    if (t.includes('化学反応') || t.includes('相性') || t.includes('chemistry') || t.includes('synergy') || t.includes('reaction')) return 'reaction';
    return null;
  };

  const pushText = (k, v) => {
    if (!k || v == null) return;
    const s = Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : String(v).trim();
    if (!s || (Array.isArray(s) && !s.length)) return;
    if (k === 'scenes' || k === 'growth' || k === 'reaction') {
      const arr = Array.isArray(v) ? v : [String(v)];
      out[k] = (out[k] || []).concat(arr.filter(Boolean));
    } else {
      out[k] = [out[k], String(v)].filter(Boolean).join('\n\n');
    }
  };

  const scan = (node) => {
    if (node == null) return;
    if (Array.isArray(node)) { node.forEach(scan); return; }
    if (typeof node !== 'object') return;

    const title = node.title || node.heading || node.label || node.name || node.key;
    const keyByTitle = titleToKey(title);

    if (keyByTitle) {
      const body = node.body || node.text || node.copy || node.description || node.content;
      const items = node.items || node.list || node.points || node.bullets || node.entries;
      if (items) pushText(keyByTitle, items);
      if (body)  pushText(keyByTitle, body);
    }

    const flatMap = {
      engine: ['engine','core','mindEngine','heart','personality','core_text','engineBody'],
      fear: ['fear','biggestFear','worst_fear','scare','risk'],
      perception: ['perception','howSeen','image','impression'],
      scenes: ['scenes','scene','best_situations','fits','situations'],
      growth: ['growth','tips','advice','coach','hints'],
      reaction: ['reaction','chemistry','synergy','compatibility'],
    };
    for (const [k, keys] of Object.entries(flatMap)) {
      for (const kk of keys) {
        if (node[kk] != null) pushText(k, node[kk]);
      }
    }

    Object.values(node).forEach(scan);
  };

  scan(api);

  return hasAnyContent(out) ? out : null;
}

function hasAnyContent(obj){
  if (!obj) return false;
  return ['engine','fear','perception','scenes','growth','reaction']
    .some(k => !!(obj[k] && String(obj[k]).trim().length || (Array.isArray(obj[k]) && obj[k].length)));
}