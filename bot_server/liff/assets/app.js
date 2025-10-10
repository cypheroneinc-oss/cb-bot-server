// filename: bot_server/liff/assets/app.js
import { diagnose, quickQC } from '../../lib/scoring.js';
import { getHeroNarrative } from '../../lib/result-content.js'; // ← 追加

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

/* 6件法（左：とてもそう思う → 右：まったくそう思わない）*/
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
  const mount = document.querySelector('#questions');
  if (!mount) { console.error('[app] #questions not found'); return; }

  const qs = await loadQuestions();
  if (!qs) {
    mount.innerHTML = `<div class="load-error">設問データの読み込みに失敗しました。/data/questions.v1.js を確認してください。</div>`;
    return;
  }

  // 単一ページで全問表示
  mount.innerHTML = renderSurvey(qs);

  // フッター配線（送信のみ）
  wireFooterSubmit();

  // プルダウン初期化（安全：未挿入時のみ追加）
  initDemographics();

  // 進捗／活性制御
  bindSinglePageHandlers();
  updateCounters();

  /* 結果を見るボタンの動作保証（多重バインド防止） */
  const submitBtn = document.getElementById('submitButton');
  if (submitBtn && !submitBtn.dataset.bound) {
    submitBtn.dataset.bound = '1';
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!validateAll()) { toast('未回答の項目があります'); return; }
      onSubmit();
    });
  }

  /* 残り問題数バー等は別要件に従い削除 */
  const progressBar = document.querySelector('.progress-bar');
  const statusText = document.querySelector('.status');
  const subtitle = document.querySelector('.subtitle');
  if (progressBar) progressBar.remove();
  if (statusText) statusText.remove();
  if (subtitle) subtitle.remove();
}

/* -----------------------------
 * 設問UI（1ページ）
 * --------------------------- */
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

/* 1問カード */
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
 * 単一ページ用：入力監視
 * --------------------------- */
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

/* フッター送信 */
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
  const weights = await loadWeights();
  if (!weights) { toast('重みデータの読み込みに失敗しました'); return; }

  const diag = diagnose(answers, { weights });

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

/* API連携 */
async function submitToApi(localAnswers) {
  const base = resolveBaseUrl();
  const url = `${base}/api/diagnosis/submit`;
  const userId = getOrCreateUserId();

  const selGender = document.getElementById('demographicsGender');
  const selAge    = document.getElementById('demographicsAge');
  const selMbti   = document.getElementById('demographicsMbti');

  const payload = {
    userId,
    version: QUESTION_VERSION,
    client: 'liff',
    answers: localAnswers.map(a => ({
      code: a.id,
      scale: a.value,
      scaleMax: 6,
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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/* -----------------------------
 * 結果描画（6ブロック本文のみ表示）
 * --------------------------- */
function renderResult({ diag /*, qc*/, api }) {
  const root = document.getElementById('resultCard') || document.querySelector('#result');
  if (!root) { console.error('[result] container not found'); return; }

  const { type_main, type_sub } = diag;
  const mainName = api?.hero?.name || type_main || '';
  const subName  = type_sub ? `（サブ: ${type_sub}）` : '';

  // 1) APIから本文をできるだけ抽出（キー名の表記ゆれ対応）
  const apiData = extractNarrativeFromApi(api);

  // 2) ダメならローカル定義（サブ括弧・slug吸収）
  let data = apiData;
  if (!hasAnyContent(data)) {
    const cleanName = String(mainName).replace(/（.*?）/g, '').trim();
    const slug = api?.hero?.slug ? String(api.hero.slug).trim() : '';
    const candidates = [type_main, cleanName, mainName, slug].filter(Boolean);
    for (const key of candidates) {
      data = getHeroNarrative(key);
      if (hasAnyContent(data)) break;
    }
    if (!hasAnyContent(data)) data = {};
  }

  // タイトル等
  const heroNameEl = root.querySelector('#resultHeroName');
  const clusterTag = root.querySelector('#resultClusterTag');
  const resultSub  = root.querySelector('#resultSub');
  if (heroNameEl) heroNameEl.textContent = `${mainName}${subName}`;
  if (clusterTag) clusterTag.textContent = '上位タイプ';
  if (resultSub)  resultSub.textContent  = '';

  // 6ブロック（既存IDが無ければ見出し直後に生成）
  const engineEl      = findOrCreateSection(root, ['#resultEngineBody', '#resultPersonalityBody'], '❤️ 心のエンジン', 'div', 'result-paragraphs');
  const fearEl        = findOrCreateSection(root, ['#resultFearBody'],       '😨 いちばん怖いこと', 'div', 'result-paragraphs');
  const perceptionEl  = findOrCreateSection(root, ['#resultPerceptionBody'], '👀 こう見られがち',   'div', 'result-paragraphs');
  const scenesEl      = findOrCreateSection(root, ['#resultScenes'],         '⚡ 活躍シーン',       'ul');
  const growthEl      = findOrCreateSection(root, ['#resultGrowth', '#resultTips'], '🌱 伸ばし方', 'ul');
  const reactionsEl   = findOrCreateSection(root, ['#resultReactions'],      '🧪 化学反応',        'ol');

  setHTML(engineEl,     asParas(data?.engine));
  setHTML(fearEl,       asParas(data?.fear));
  setHTML(perceptionEl, asParas(data?.perception));
  setList(scenesEl,     data?.scenes);
  setList(growthEl,     data?.growth);
  setList(reactionsEl,  data?.reaction, { ordered: true });

  // ヒーロー画像
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

/* -----------------------------
 * 進捗/ダイヤル（温存）
 * --------------------------- */
function updateCounters() {
  const form = document.getElementById('survey-form');
  if (!form) return;
  const answered = form.querySelectorAll('input[type="radio"]:checked').length;
  const total = form.querySelectorAll('.question-card .likert-input').length / 6;
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

/* ================================
 * ▼ プルダウンへの選択肢注入
 * ================================ */
function initDemographics() {
  const selGender = document.getElementById('demographicsGender');
  const selAge    = document.getElementById('demographicsAge');
  const selMbti   = document.getElementById('demographicsMbti');

  if (selGender && selGender.options.length <= 1) {
    ['男性','女性','その他・回答しない'].forEach(v => {
      const op = document.createElement('option'); op.value = v; op.textContent = v; selGender.appendChild(op);
    });
  }
  if (selAge && selAge.options.length <= 1) {
    for (let a = 12; a <= 50; a++) { const op = document.createElement('option'); op.value = String(a); op.textContent = `${a}`; selAge.appendChild(op); }
  }
  if (selMbti && selMbti.options.length <= 1) {
    const MBTI_JA = [
      ['INTJ','建築家'], ['INTP','論理学者'],
      ['ENTJ','指揮官'], ['ENTP','討論者'],
      ['INFJ','提唱者'], ['INFP','仲介者'],
      ['ENFJ','主人公'], ['ENFP','広報運動家'],
      ['ISTJ','管理者'], ['ISFJ','擁護者'],
      ['ESTJ','幹部'], ['ESFJ','領事'],
      ['ISTP','巨匠'], ['ISFP','冒険家'],
      ['ESTP','起業家'], ['ESFP','エンターテイナー'],
    ];
    MBTI_JA.forEach(([code, ja]) => {
      const op = document.createElement('option');
      op.value = code;
      op.textContent = `${code}（${ja}）`;
      selMbti.appendChild(op);
    });
  }
}

/* ================================
 * ▼ 追加：入力の完全性チェック
 * ================================ */
function validateDemographics() {
  const g = document.getElementById('demographicsGender');
  const a = document.getElementById('demographicsAge');
  const m = document.getElementById('demographicsMbti');
  const okG = !g || !!g.value;
  const okA = !a || !!a.value;
  const okM = !m || !!m.value;
  return okG && okA && okM;
}

function validateAll() {
  const form = document.getElementById('survey-form');
  if (!form) return false;
  const totalQuestions = form.querySelectorAll('.question-card').length;
  const answered = form.querySelectorAll('input[type="radio"]:checked').length;
  const questionsOk = totalQuestions > 0 && answered >= totalQuestions;
  return questionsOk && validateDemographics();
}

/* ================================
 * ▼ 補助：本文注入ユーティリティ
 * ================================ */
function setHTML(elOrSel, htmlOrText) {
  const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
  if (!el) return;
  if (typeof htmlOrText === 'string') el.innerHTML = htmlOrText;
  else el.textContent = String(htmlOrText ?? '');
}
function asParas(text) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (trimmed.startsWith('<')) return trimmed;
  return trimmed.split(/\n{2,}/).map(t => `<p>${escapeHtml(t.trim())}</p>`).join('');
}
function setList(elOrSel, value, { ordered = false } = {}) {
  const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
  if (!el) return;
  if (typeof value === 'string' && value.trim().startsWith('<')) { el.innerHTML = value; return; }
  const arr = Array.isArray(value) ? value : (value ? [value] : []);
  const items = arr.map(x => `<li>${escapeHtml(String(x))}</li>`).join('');
  el.innerHTML = items;
}

/* ================================
 * ▼ 生成ヘルパー（不足DOMを見出し直後に作る）
 * ================================ */
function findOrCreateSection(root, selectors, headingText, tag = 'div', className = '') {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  const hs = [...root.querySelectorAll('h3')];
  const h = hs.find(x => x.textContent.trim().replace(/\s+/g,'') === headingText.replace(/\s+/g,''));
  const container = document.createElement(tag);
  if (className) container.className = className;
  if (h && h.parentNode) h.parentNode.insertBefore(container, h.nextSibling);
  else root.appendChild(container);
  return container;
}

/* ================================
 * ▼ API本文抽出（キー表記ゆれ対応）
 * ================================ */
function extractNarrativeFromApi(api) {
  if (!api || typeof api !== 'object') return null;

  // 候補ルートをゆるく統合
  const roots = [
    api, api.data, api.result, api.payload, api.content, api.sections, api.narrative, api.narratives,
    api.hero, api.hero?.content, api.hero?.sections, api.hero?.narrative, api.hero?.narratives,
  ].filter(x => x && typeof x === 'object');

  const merged = Object.assign({}, ...roots);

  const pick = (...cands) => {
    // 完全一致
    for (const k of cands) if (merged[k] != null) return merged[k];
    // 大文字小文字/日本語含む部分一致
    const keys = Object.keys(merged);
    for (const want of cands) {
      const idx = keys.find(k => k.toLowerCase().includes(String(want).toLowerCase()));
      if (idx) return merged[idx];
    }
    return null;
  };

  const out = {
    engine:     pick('engine','core','drive','mindEngine','heart','personality','心のエンジン','個性','core_text','engineBody'),
    fear:       pick('fear','biggestFear','worst_fear','scare','risk','いちばん怖いこと','恐れ','アンチパターン'),
    perception: pick('perception','howSeen','image','こう見られがち','見られがち','他者からの見え方'),
    scenes:     pick('scenes','scene','best_situations','活躍シーン','fits','situations'),
    growth:     pick('growth','tips','advice','coach','伸ばし方','成長のヒント'),
    reaction:   pick('reaction','chemistry','synergy','相性','化学反応'),
  };

  return hasAnyContent(out) ? out : null;
}

function hasAnyContent(obj){
  if (!obj) return false;
  return ['engine','fear','perception','scenes','growth','reaction']
    .some(k => !!(obj[k] && String(obj[k]).trim().length));
}