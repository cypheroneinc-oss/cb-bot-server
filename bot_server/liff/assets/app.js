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

/* 1問カード（ひし形下の可視ラベルは無し） */
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

/* -----------------------------
 * 診断と結果
 * --------------------------- */
async function onSubmit() {
  const answers = collectAnswers();
  const qc = quickQC(answers);
  const weights = await loadWeights();
  if (!weights) { toast('重みデータの読み込みに失敗しました'); return; }

  // ローカル推定（従来どおり）
  const diag = diagnose(answers, { weights });

  // ★ 追加：サーバAPIへ送信して“マッパ確定タイプ”を取得（失敗時はローカルのみで続行）
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

/**
 * ★ 新規：API連携（サーバ側 archetype-mapper.js とリンク）
 * - 既存UI/コードは変更しない。タイプだけサーバ確定値を優先使用。
 */
async function submitToApi(localAnswers) {
  const base = resolveBaseUrl();
  const url = `${base}/api/diagnosis/submit`;
  const userId = getOrCreateUserId();

  // demographics（任意）
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
      scaleMax: 6, // 本UIは常に6件法
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

function renderResult({ diag /*, qc*/, api }) {
  const root = document.querySelector('#result');
  const { type_main, type_sub, confidence, balanceIndex, prob, vec } = diag;

  // ★ サーバ優先：タイプ名・アバター（なければ従来ローカル）
  const apiHeroName = api?.hero?.name || null;
  const apiHeroSlug = api?.hero?.slug || null;
  const apiHeroImg  = api?.hero?.avatarUrl || null;

  const displayTypeMain = apiHeroName || type_main;
  const displayTypeSub  = type_sub;

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
        <h2 id="resultHeroName">${escapeHtml(displayTypeMain)}${displayTypeSub ? `（サブ: ${escapeHtml(displayTypeSub)}）` : ''}</h2>
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

  // 結果後は「戻る」= リトライに変える
  const backBtn = document.getElementById('retryButton');
  const nextBtn = document.getElementById('submitButton');
  if (backBtn) {
    backBtn.classList.remove('hidden');
    backBtn.textContent = 'もう一度診断する';
    backBtn.onclick = () => location.reload();
  }
  nextBtn?.classList.add('hidden');

  // 画像（サーバ優先、なければ何もしない）
  const img = document.getElementById('resultHeroImage');
  if (img && apiHeroImg) img.src = apiHeroImg;

  document.getElementById('shareWebButton')?.addEventListener('click', () => {
    const text = `私のアーキタイプは「${displayTypeMain}」${displayTypeSub ? `（サブ: ${displayTypeSub}）` : ''}。信頼度${(confidence*100).toFixed(0)}%`;
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

// APIベースURL解決（submit.js と同様の優先順位）
function resolveBaseUrl(){
  const meta = document.querySelector('meta[name="app-base-url"]')?.content?.trim();
  if (meta) return meta.replace(/\/$/,'');
  const env = window?.__APP_BASE_URL__ || '';
  if (env) return String(env).replace(/\/$/,'');
  return ''; // same-origin
}

// 匿名userIdをローカルに保持
function getOrCreateUserId(){
  const key = 'cb_user_id';
  let v = localStorage.getItem(key);
  if (!v) { v = crypto?.randomUUID?.() || `anon-${Date.now()}`; localStorage.setItem(key, v); }
  return v;
}

/* ================================
 * ▼ プルダウンへの選択肢注入（ここが肝）
 * ================================ */
function initDemographics() {
  const selGender = document.getElementById('demographicsGender');
  const selAge    = document.getElementById('demographicsAge');
  const selMbti   = document.getElementById('demographicsMbti');

  // 既に選択肢が入っていれば触らない（重複防止）
  if (selGender && selGender.options.length <= 1) {
    ['男性','女性','その他・回答しない'].forEach(v => {
      const op = document.createElement('option'); op.value = v; op.textContent = v; selGender.appendChild(op);
    });
  }
  if (selAge && selAge.options.length <= 1) {
    for (let a = 12; a <= 50; a++) { const op = document.createElement('option'); op.value = String(a); op.textContent = `${a}`; selAge.appendChild(op); }
  }
  // ★ MBTIだけ表示を「コード（日本語ニックネーム）」にする（値はコードのまま）
  if (selMbti && selMbti.options.length <= 1) {
    const MBTI_JA = [
      ['INTJ','建築家'],      ['INTP','論理学者'],
      ['ENTJ','指揮官'],      ['ENTP','討論者'],
      ['INFJ','提唱者'],      ['INFP','仲介者'],
      ['ENFJ','主人公'],      ['ENFP','広報運動家'],
      ['ISTJ','管理者'],      ['ISFJ','擁護者'],
      ['ESTJ','幹部'],        ['ESFJ','領事'],
      ['ISTP','巨匠'],        ['ISFP','冒険家'],
      ['ESTP','起業家'],      ['ESFP','エンターテイナー'],
    ];
    MBTI_JA.forEach(([code, ja]) => {
      const op = document.createElement('option');
      op.value = code;
      op.textContent = `${code}（${ja}）`;
      selMbti.appendChild(op);
    });
  }
}
/* ================================ */
