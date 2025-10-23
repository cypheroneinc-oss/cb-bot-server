// filename: bot_server/liff/assets/app.js
// v3(30問)対応版：?v=3 で API 経由フローに切替（設問取得→回答収集→submit→v3結果描画）
// 既存(v1)フローは従来通り（ローカル diagnose/quickQC ）。
// ------------------------------------------------------

import { diagnose, quickQC } from '../../lib/scoring.js';

/* -----------------------------
 * 動的ロード（既存）
 * --------------------------- */
let QUESTIONS = null;
async function loadQuestionsLocalV1() {
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
async function loadWeightsV1() {
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
const QUESTION_VERSION_DEFAULT = 'v1';

// 6件法（左：とてもそう思う → 右：まったくそう思わない）
const LIKERT_REVERSED = [
  { value: 6, label: 'とてもそう思う' },
  { value: 5, label: 'かなりそう思う' },
  { value: 4, label: '少しそう思う' },
  { value: 3, label: '少しそう思わない' },
  { value: 2, label: 'かなりそう思わない' },
  { value: 1, label: 'まったくそう思わない' },
];

/* -----------------------------
 * v3 切替ヘルパ
 * --------------------------- */
function getQueryParam(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name);
}
function isV3Mode() {
  const v = (getQueryParam('v') || getQueryParam('version') || '').toLowerCase();
  return v === '3' || v === 'v3';
}
let CURRENT_VERSION = isV3Mode() ? '3' : QUESTION_VERSION_DEFAULT;

/* ----------------------------- */
window.addEventListener('DOMContentLoaded', () => { mountApp(); });

async function mountApp() {
  const mount = document.querySelector('#questions');
  if (!mount) { console.error('[app] #questions not found'); return; }

  // v3: APIから設問取得 / v1: 既存ローカル読み込み
  let qs = null;
  if (CURRENT_VERSION === '3') {
    const res = await fetch(`/api/diagnosis?v=3`, { cache: 'no-store' });
    if (!res.ok) {
      mount.innerHTML = `<div class="load-error">設問の取得に失敗しました（v3）。</div>`;
      return;
    }
    const data = await res.json();
    CURRENT_VERSION = String(data?.version || '3');
    qs = Array.isArray(data?.questions) ? data.questions : null;
  } else {
    qs = await loadQuestionsLocalV1();
  }

  if (!qs) {
    mount.innerHTML = `<div class="load-error">設問データの読み込みに失敗しました。</div>`;
    return;
  }

  mount.innerHTML = renderSurvey(qs);
  bindSurveyHandlers();     // ← フッターに結線
  updateCounters();

  // プルダウン注入（性別/年齢/MBTI）
  initDemographics();
}

/* -----------------------------
 * 設問UI
 * --------------------------- */
function renderSurvey(qs) {
  // v3: 30問 → 10/10/10 | v1: 36問 → 10/10/10/6
  const pageSize = 10;
  const groups = chunk(qs, pageSize);
  const pagesHtml = groups.map((g, pageIdx) => `
    <section class="page" data-page="${pageIdx}">
      ${g.map(renderItem).join('')}
    </section>
  `).join('');

  return `
    <form id="survey-form" aria-live="polite">
      ${pagesHtml}
    </form>
    <section class="result-card hidden" id="result"></section>
  `;
}

function renderItem(q) {
  const name = q.id || q.code;
  const opts = LIKERT_REVERSED.map((o) => {
    const id = `${name}-${o.value}`;
    return `
      <div class="likert-choice">
        <input class="likert-input" type="radio" id="${id}" name="${name}" value="${o.value}" required data-code="${name}">
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
 * ページング（既存）
 * --------------------------- */
function bindSurveyHandlers() {
  const form = document.querySelector('#survey-form');
  const pages = [...form.querySelectorAll('.page')];
  let pageIndex = 0;

  const backBtn  = document.getElementById('retryButton');   // secondary
  const nextBtn  = document.getElementById('submitButton');  // primary
  const nextLabel= document.getElementById('submitContent');

  backBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (pageIndex > 0) { pageIndex -= 1; updatePage(); }
  });
  nextBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const isLast = pageIndex === pages.length - 1;
    if (!isLast) {
      if (!validateCurrentPage()) { toast('未回答の項目があります'); return; }
      pageIndex = Math.min(pages.length - 1, pageIndex + 1);
      updatePage();
    } else {
      if (!validateAll()) { toast('未回答の項目があります'); return; }
      // v3 / v1 分岐
      if (CURRENT_VERSION === '3') {
        nextBtn.disabled = true;
        nextLabel.textContent = '送信中…';
        try { await onSubmitV3(); }
        finally {
          nextBtn.disabled = false;
          nextLabel.textContent = '結果を見る';
        }
      } else {
        await onSubmitV1();
      }
    }
  });

  form.addEventListener('change', () => {
    updateCounters();
    refreshFooter();
  });

  updatePage();

  function updatePage() {
    pages.forEach((p, i) => p.hidden = i !== pageIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateCounters();
    refreshFooter();
  }

  function validateCurrentPage() {
    const current = pages[pageIndex];
    const inputs = current.querySelectorAll('input[type="radio"]');
    const groups = groupBy([...inputs], el => el.name);
    return Object.values(groups).every(arr => arr.some(el => el.checked));
  }

  function validateAll() {
    const inputs = form.querySelectorAll('input[type="radio"]');
    const groups = groupBy([...inputs], el => el.name);
    return Object.values(groups).every(arr => arr.some(el => el.checked));
  }

  function refreshFooter() {
    const isFirst = pageIndex === 0;
    const isLast  = pageIndex === pages.length - 1;

    if (backBtn) {
      backBtn.classList.toggle('hidden', isFirst);
      backBtn.textContent = isFirst ? '戻る' : '戻る';
      backBtn.disabled = isFirst;
    }
    if (nextBtn && nextLabel) {
      nextLabel.textContent = isLast ? '結果を見る' : '次へ';
      nextBtn.disabled = isLast ? !validateAll() : !validateCurrentPage();
      nextBtn.classList.remove('hidden');
    }
    document.getElementById('resultActions')?.classList.add('hidden');
  }
}

/* -----------------------------
 * v1 既存フロー
 * --------------------------- */
async function onSubmitV1() {
  const answers = collectAnswersAsArray(); // [{id, value}]
  const qc = quickQC(answers);
  const weights = await loadWeightsV1();
  if (!weights) { toast('重みデータの読み込みに失敗しました'); return; }
  const diag = diagnose(answers, { weights });
  renderResultV1({ diag, qc });
}

function collectAnswersAsArray() {
  const inputs = document.querySelectorAll('#survey-form input[type="radio"]:checked');
  return [...inputs].map(el => ({ id: el.name, value: Number(el.value) }));
}

function renderResultV1({ diag /*, qc*/ }) {
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

  const backBtn = document.getElementById('retryButton');
  const nextBtn = document.getElementById('submitButton');
  const nextLabel = document.getElementById('submitContent');

  if (backBtn) {
    backBtn.classList.remove('hidden');
    backBtn.textContent = 'もう一度診断する';
    backBtn.onclick = () => location.reload();
  }
  if (nextBtn && nextLabel) {
    nextBtn.classList.add('hidden');
  }

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
 * v3 新フロー（API採点）
 * --------------------------- */
async function onSubmitV3() {
  const answersDict = collectAnswersAsDict(); // {Q01: 1..6, ...}
  const allCodes = Object.keys(answersDict);
  if (allCodes.length < document.querySelectorAll('.question-card').length) {
    toast('未回答の項目があります'); return;
  }

  const userId = await resolveUserId();
  const payload = {
    version: 3,
    userId,
    // sessionId は空で送れば submit API 側が発行
    answers: answersDict,
    // 参考：メタ（省略可）
    meta: {
      demographics: collectDemographics(),
      client: 'liff',
    }
  };

  let res;
  try {
    res = await fetch('/api/diagnosis/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[submit:v3] network', e);
    toast('送信に失敗しました'); return;
  }
  if (!res.ok) {
    const err = await safeJson(res);
    console.error('[submit:v3] bad', err);
    toast('採点に失敗しました'); return;
  }
  const result = await res.json();
  renderV3Blocks(result);
}

function collectAnswersAsDict() {
  const inputs = document.querySelectorAll('#survey-form input[type="radio"]:checked');
  const dict = {};
  for (const el of inputs) {
    const code = el.getAttribute('name') || el.getAttribute('data-code');
    const val = Number(el.value);
    if (code && Number.isFinite(val)) dict[code] = val;
  }
  return dict;
}

async function resolveUserId() {
  try {
    if (window.liff?.getProfile) {
      const prof = await window.liff.getProfile();
      if (prof?.userId) return prof.userId;
    }
  } catch (_) {}
  // フォールバック
  const key = 'cbm_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = `web-${Math.random().toString(36).slice(2)}${Date.now()}`;
    localStorage.setItem(key, v);
  }
  return v;
}

function collectDemographics() {
  const g = document.getElementById('demographicsGender')?.value || '';
  const a = document.getElementById('demographicsAge')?.value || '';
  const m = (document.getElementById('demographicsMbti')?.value || '').toUpperCase();
  return { gender: g, age: a, mbti: m };
}

async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}

/* --- v3: 結果描画（テキスト先行、後で図を差し込み可能） --- */
function renderV3Blocks(result) {
  const root = document.querySelector('#result');
  const arch = result?.archetype || {};
  const ideal = Array.isArray(result?.idealTop3) ? result.idealTop3 : [];
  const indus = Array.isArray(result?.industryTop5) ? result.industryTop5 : [];
  const hexaco = result?.hexaco || {};
  const balance = result?.balance || {};

  const archLabel = arch.label || (window.ARCHETYPE_LABELS_V3?.[arch.key] || arch.key || '-');

  const idealList = ideal.map(x => {
    const label = x.label || window.IDEAL_LABELS_V3?.[x.id] || x.id;
    const sc = Math.round(Number(x.score || 0));
    return `<li><span class="t">${escapeHtml(label)}</span><span class="v">${sc}</span></li>`;
  }).join('');

  const indList = indus.map(x => {
    const label = x.label || window.INDUSTRY_LABELS_V3?.[x.id] || x.id;
    const star = '★'.repeat(Number(x.star || 1));
    const blurb = x.blurb || (window.INDUSTRY_BLURBS?.[x.id] || '');
    return `<li><span class="t">${escapeHtml(label)}</span><span class="star">${star}</span><span class="blurb">${escapeHtml(blurb)}</span></li>`;
  }).join('');

  const hexList = Object.entries(hexaco).map(([k,v]) => {
    return `<li><span class="t">${escapeHtml(prettyHexLabel(k))}</span><span class="v">${Math.round(Number(v||0))}</span></li>`;
  }).join('');

  root.innerHTML = `
    <header class="result-header">
      <h1>診断が完了したよ</h1>
      <p id="resultSub">バージョン v${escapeHtml(String(result?.version || '3'))}</p>
    </header>

    <div class="hero-card">
      <div class="hero-avatar"><img id="resultHeroImage" alt=""></div>
      <div class="hero-details">
        <span class="cluster-tag">タイプ</span>
        <h2 id="resultHeroName">${escapeHtml(archLabel)}</h2>
      </div>
    </div>

    <section class="balance">
      <h3>バランス</h3>
      ${renderBalanceBars(balance)}
    </section>

    <section class="ideal">
      <h3>理想Top3</h3>
      <ul class="prob-list">${idealList}</ul>
    </section>

    <section class="industry">
      <h3>業界Top5</h3>
      <ul class="prob-list">${indList}</ul>
    </section>

    <section class="hexaco">
      <h3>HEXACO（6因子）</h3>
      <ul class="prob-list">${hexList}</ul>
    </section>

    ${renderRoadmapBlock(arch?.key, ideal?.[0]?.id)}
    
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

  // フッター
  const backBtn = document.getElementById('retryButton');
  const nextBtn = document.getElementById('submitButton');
  const nextLabel = document.getElementById('submitContent');

  if (backBtn) {
    backBtn.classList.remove('hidden');
    backBtn.textContent = 'もう一度診断する';
    backBtn.onclick = () => location.search = '?v=3'; // v3を維持して再診断
  }
  if (nextBtn && nextLabel) {
    nextBtn.classList.add('hidden');
  }

  // シェア
  const shareUrl = result?.share?.url || location.href;
  document.getElementById('shareWebButton')?.addEventListener('click', () => {
    const text = `タイプは「${archLabel}」でした。`;
    if (navigator.share) navigator.share({ text, url: shareUrl }).catch(() => copyToClipboard(`${text} ${shareUrl}`));
    else copyToClipboard(`${text} ${shareUrl}`);
    toast('結果を共有しました');
  });
  document.getElementById('shareCopyButton')?.addEventListener('click', () => {
    copyToClipboard(shareUrl);
    toast('リンクをコピーしました');
  });

  // 直近結果をローカル保存（比較用）
  try { localStorage.setItem('cbm_v3_last', JSON.stringify(result)); } catch {}
}

function renderBalanceBars(balance) {
  const keys = [
    ['speech','言動'],
    ['emotion','感情'],
    ['action','行動']
  ];
  return `
    <div class="balance-bars">
      ${keys.map(([k, label]) => {
        const v = Math.round(Number(balance?.[k] || 0));
        return `
          <div class="dial">
            <div class="dial-head"><span class="label">${label}</span><span class="num">${v}</span></div>
            <div class="bar"><span style="width:${v}%"></span></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function prettyHexLabel(k) {
  const map = {
    HonestyHumility: '誠実-謙虚',
    Emotionality: '情動性',
    eXtraversion: '外向性',
    Agreeableness: '協調性',
    Conscientiousness: '勤勉性',
    Openness: '開放性',
  };
  return map[k] || k;
}

function renderRoadmapBlock(archKey, idealId) {
  const text = (window.ROADMAP?.[archKey]?.[idealId]) || '';
  if (!text) return '';
  return `
    <section class="roadmap">
      <h3>理想へのロードマップ</h3>
      <p>${escapeHtml(text)}</p>
    </section>
  `;
}

/* -----------------------------
 * 進捗/ダイヤル（既存）
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
 * helpers（既存）
 * --------------------------- */
function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
function groupBy(arr, keyFn) { return arr.reduce((m, x) => { const k = keyFn(x); (m[k] ||= []).push(x); return m; }, {}); }
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

/* ================================
 * ▼ 追加：プルダウンへの選択肢注入
 * ================================ */
function initDemographics() {
  const selGender = document.getElementById('demographicsGender');
  const selAge    = document.getElementById('demographicsAge');
  const selMbti   = document.getElementById('demographicsMbti');

  if (selGender && selGender.options.length <= 1) {
    const genders = ['男性','女性','その他・回答しない'];
    genders.forEach(v => {
      const op = document.createElement('option');
      op.value = v; op.textContent = v;
      selGender.appendChild(op);
    });
  }

  if (selAge && selAge.options.length <= 1) {
    for (let a = 12; a <= 50; a++) {
      const op = document.createElement('option');
      op.value = String(a);
      op.textContent = `${a}`;
      selAge.appendChild(op);
    }
  }

  if (selMbti && selMbti.options.length <= 1) {
    const types = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
    types.forEach(t => {
      const op = document.createElement('option');
      op.value = t; op.textContent = t;
      selMbti.appendChild(op);
    });
  }
}