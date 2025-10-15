// filename: bot_server/liff/assets/app.js
import { diagnose, quickQC } from '../../lib/scoring.js';
import { getHeroNarrative } from '../../lib/result-content.js'; // ← 追加

/* ----------------------------- */
// サーバ契約に合わせて常に 'v1' を送る（サーバが v2 解禁まで固定）
const SERVER_QUESTION_SET_VERSION = 'v1';
const QUESTION_VERSION = SERVER_QUESTION_SET_VERSION; // UI側の識別も同一にしておく

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
  if (!mount) {
    console.error('[app] #questions not found');
    return;
  }

  const qs = await loadQuestions();
  if (!qs) {
    mount.innerHTML = `\n      <div class="error">設問データの読み込みに失敗しました。/data/questions.v1.js を確認してください。</div>\n    `;
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

  /* 残り問題数バー等は別要件に従い削除して良い場合のみここでremove()する */
  const progressBar = document.querySelector('.progress-bar');
  const statusText = document.querySelector('.status');
  const subtitle = document.querySelector('.subtitle');
  if (progressBar) progressBar.remove();
  if (statusText) statusText.remove();
  if (subtitle) subtitle.remove();
}

/* ----------------------------- *
 * 設問UI（1ページ）
 * --------------------------- */
function renderSurvey(qs) {
  const itemsHtml = qs.map(renderItem).join('');
  return `
    <form id="survey-form" class="survey">
      ${itemsHtml}
    </form>
  `;
}

/* 1問カード（ひし形下の可視ラベルは無し） */
function renderItem(q) {
  const name = q.id;
  const opts = LIKERT_REVERSED.map((o) => {
    const id = `${name}-${o.value}`;
    return `
      <label class="likert-option">
        <input class="likert-input" type="radio" name="${name}" id="${id}" value="${o.value}" />
        <span class="visually-hidden">${o.label}</span>
      </label>
    `;
  }).join('');

  return `
    <div class="question-card">
      <h3 class="question-text">${escapeHtml(q.text)}</h3>
      <div class="likert-row">${opts}</div>
      <div class="likert-captions">
        <span>とてもそう思う</span>
        <span>まったくそう思わない</span>
      </div>
    </div>
  `;
}

/* ----------------------------- *
 * 単一ページ用：入力監視 → 進捗と送信活性
 * --------------------------- */
function bindSinglePageHandlers() {
  const form = document.querySelector('#survey-form');
  const submitBtn = document.getElementById('submitButton');
  const submitLabel = document.getElementById('submitContent');
  const backBtn = document.getElementById('retryButton');

  // 「戻る」は使わない → 非表示固定
  backBtn?.classList.add('hidden');

  // ボタンラベルは常に「結果を見る」
  if (submitLabel) submitLabel.textContent = '結果を見る';

  // 入力が変わるたびに進捗・活性を更新
  form.addEventListener('change', () => {
    updateCounters();
    submitBtn.disabled = !validateAll();
  });

  // 初期活性
  submitBtn.disabled = !validateAll();
}

/* フッターの送信ボタン（UIは既存のまま） */
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

/* ----------------------------- *
 * 診断と結果
 * --------------------------- */
async function onSubmit() {
  const answers = collectAnswers();
  const qc = quickQC(answers);
  const weights = await loadWeights();
  if (!weights) {
    toast('重みデータの読み込みに失敗しました');
    return;
  }

  // ローカル推定
  const diag = diagnose(answers, { weights });

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

/* API連携 */
async function submitToApi(localAnswers) {
  const base = resolveBaseUrl();
  const url = `${base}/api/diagnosis/submit`;
  const userId = getOrCreateUserId(); // ✅ 必須。payload に含める

  const selGender = document.getElementById('demographicsGender');
  const selAge = document.getElementById('demographicsAge');
  const selMbti = document.getElementById('demographicsMbti');

  // ✅ 厳格版：必要項目のみ送る + userId は必須
  const payload = {
    userId,
    // サーバ契約（v1）を強制。将来の変更時は SERVER_QUESTION_SET_VERSION を差し替え。
    version: SERVER_QUESTION_SET_VERSION,
    // 念のため両方送る（サーバがどちらかを参照してもOK）
    questionSetVersion: SERVER_QUESTION_SET_VERSION,
    // クライアント側の識別用（デバッグ用に残す）。
    clientQuestionVersion: String(QUESTION_VERSION),
    answers: localAnswers.map(a => ({
      questionId: a.id,
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

  // 将来の改修や別ブランチで version が変わっていても、送信直前で正規化して事故防止
  if (String(payload.version) !== SERVER_QUESTION_SET_VERSION) {
    console.warn('[diag] normalize version ->', SERVER_QUESTION_SET_VERSION, '(was:', payload.version, ')');
    payload.version = SERVER_QUESTION_SET_VERSION;
  }
  if (String(payload.questionSetVersion) !== SERVER_QUESTION_SET_VERSION) {
    payload.questionSetVersion = SERVER_QUESTION_SET_VERSION;
  }

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

/* ----------------------------- *
 * 結果描画（6ブロック本文のみ表示）
 * --------------------------- */
function renderResult({ diag /*, qc*/, api }) {
  // --- debug begin ---
  window.__DBG = { api, diag };
  console.log('[DEBUG api]', api && JSON.stringify(api).slice(0, 1000));
  console.log('[DEBUG diag]', diag);
  // --- debug end ---

  const root = document.getElementById('resultCard') || document.querySelector('#result');
  if (!root) {
    console.error('[result] container not found');
    return;
  }

  const { type_main, type_sub } = diag;
  const mainName = api?.hero?.name || type_main || '';
  const subName = type_sub ? `（サブ: ${type_sub}）` : '';

  const apiData = deepExtractNarrativeFromApi(api);
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

  const heroNameEl = root.querySelector('#resultHeroName');
  const clusterTag = root.querySelector('#resultClusterTag');
  const resultSub = root.querySelector('#resultSub');
  if (heroNameEl) heroNameEl.textContent = `${mainName}${subName}`;
  if (clusterTag) clusterTag.textContent = '上位タイプ';
  if (resultSub) resultSub.textContent = '';

  setHTML(findOrCreateSection(root, ['#resultEngineBody', '#resultPersonalityBody'], '❤️ 心のエンジン', 'div', 'result-paragraphs'), asParas(data?.engine));
  setHTML(findOrCreateSection(root, ['#resultFearBody'], ' いちばん怖いこと', 'div', 'result-paragraphs'), asParas(data?.fear));
  setHTML(findOrCreateSection(root, ['#resultPerceptionBody'], ' こう見られがち', 'div', 'result-paragraphs'), asParas(data?.perception));
  setList(findOrCreateSection(root, ['#resultScenes'], '⚡ 活躍シーン', 'ul'), data?.scenes);
  setList(findOrCreateSection(root, ['#resultGrowth', '#resultTips'], ' 伸ばし方', 'ul'), data?.growth);
  setList(findOrCreateSection(root, ['#resultReactions'], ' 化学反応', 'ol'), data?.reaction, { ordered: true });

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

/* ----------------------------- */
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
      <div class="dial-label">${escapeHtml(label)}</div>
      <div class="dial-value">${Number(value)}</div>
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

/* ----------------------------- */
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({
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
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
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
  if (!v) {
    v = crypto?.randomUUID?.() || `anon-${Date.now()}`;
    localStorage.setItem(key, v);
  }
  return v;
}

/* ================================ */
function initDemographics() {
  const selGender = document.getElementById('demographicsGender');
  const selAge = document.getElementById('demographicsAge');
  const selMbti = document.getElementById('demographicsMbti');

  if (selGender && selGender.options.length <= 1) {
    ['男性','女性','その他・回答しない'].forEach(v => {
      const op = document.createElement('option');
      op.value = v; op.textContent = v; selGender.appendChild(op);
    });
  }
  if (selAge && selAge.options.length <= 1) {
    for (let a = 12; a <= 50; a++) {
      const op = document.createElement('option');
      op.value = String(a); op.textContent = `${a}`; selAge.appendChild(op);
    }
  }
  if (selMbti && selMbti.options.length <= 1) {
    const MBTI_JA = [
      ['INTJ','建築家'], ['INTP','論理学者'], ['ENTJ','指揮官'], ['ENTP','討論者'],
      ['INFJ','提唱者'], ['INFP','仲介者'], ['ENFJ','主人公'], ['ENFP','広報運動家'],
      ['ISTJ','管理者'], ['ISFJ','擁護者'], ['ESTJ','幹部'], ['ESFJ','領事'],
      ['ISTP','巨匠'], ['ISFP','冒険家'], ['ESTP','起業家'], ['ESFP','エンターテイナー'],
    ];
    MBTI_JA.forEach(([code, ja]) => {
      const op = document.createElement('option');
      op.value = code; op.textContent = `${code}（${ja}）`; selMbti.appendChild(op);
    });
  }
}

/* ================================ */
function validateDemographics() {
  const g = document.getElementById('demographicsGender');
  const a = document.getElementById('demographicsAge');
  const m = document.getElementById('demographicsMbti');
  const okG = !g || !!g.value; const okA = !a || !!a.value; const okM = !m || !!m.value;
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

/* ================================ */
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

/* ================================ */
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

/* ================================ */
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
      if (body) pushText(keyByTitle, body);
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
