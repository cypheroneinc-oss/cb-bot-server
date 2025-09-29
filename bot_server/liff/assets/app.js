import QUESTIONS from '../../data/questions.v1.js';
import { getHeroNarrative, getHeroProfile, getClusterLabel } from '../../lib/result-content.js';

const LIFF_ID = resolveLiffId();
const BASE_URL = resolveBaseUrl();

const QUESTION_VERSION = 'v1';

const LIKERT_OPTIONS = [
  { value: 1, label: 'とてもそう思う', size: 'large' },
  { value: 2, label: 'かなりそう思う', size: 'medium' },
  { value: 3, label: '少しそう思う', size: 'small' },
  { value: 4, label: '少しそう思わない', size: 'small' },
  { value: 5, label: 'かなりそう思わない', size: 'medium' },
  { value: 6, label: '全くそう思わない', size: 'large' },
];

const LIKERT_SHORTCUT_KEYS = new Set(['1', '2', '3', '4', '5', '6']);

/* ▼ 追加：基本情報の選択肢 */
const GENDER_OPTIONS = [
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'other', label: 'その他' },
];

const AGE_OPTIONS = Array.from({ length: 39 }, (_, i) => {
  const age = 12 + i; // 12〜50（含む）
  return { value: String(age), label: `${age}歳` };
});

const MBTI_OPTIONS = [
  { value: 'ENFP', label: 'ENFP 広報運動家' },
  { value: 'ENFJ', label: 'ENFJ 主人公' },
  { value: 'ENTP', label: 'ENTP 討論者' },
  { value: 'ENTJ', label: 'ENTJ 指揮官' },
  { value: 'ESFP', label: 'ESFP エンターテイナー' },
  { value: 'ESFJ', label: 'ESFJ 領事' },
  { value: 'ESTP', label: 'ESTP 起業家' },
  { value: 'ESTJ', label: 'ESTJ 幹部' },
  { value: 'INFP', label: 'INFP 仲介者' },
  { value: 'INFJ', label: 'INFJ 提唱者' },
  { value: 'INTP', label: 'INTP 論理学者' },
  { value: 'INTJ', label: 'INTJ 建築家' },
  { value: 'ISFP', label: 'ISFP 冒険家' },
  { value: 'ISFJ', label: 'ISFJ 擁護者' },
  { value: 'ISTP', label: 'ISTP 巨匠' },
  { value: 'ISTJ', label: 'ISTJ 管理者' },
];
/* ▲ 追加ここまで */

const appState = {
  version: QUESTION_VERSION,
  questions: [],
  answers: new Map(),
  sessionId: getSessionParam(),
  submitting: false,
  profile: { userId: 'debug-user', displayName: 'Debug User' },
  result: null,
  reviewing: false,
  /* ▼ 追加：基本情報の状態 */
  demographics: { gender: '', age: '', mbti: '' },
  /* ▲ 追加ここまで */
};

const elements = {
  questions: document.getElementById('questions'),
  progressFill: document.getElementById('progressFill'),
  answeredCount: document.getElementById('answeredCount'),
  remainingCount: document.getElementById('remainingCount'),
  loadError: document.getElementById('loadError'),
  submitButton: document.getElementById('submitButton'),
  submitContent: document.getElementById('submitContent'),
  shareButton: document.getElementById('shareButton'),
  toast: document.getElementById('toast'),
  retryButton: document.getElementById('retryButton'),
  retakeButton: document.getElementById('retakeButton'),
  reviewButton: document.getElementById('reviewButton'),
  resultActions: document.getElementById('resultActions'),

  // result card
  resultCard: document.getElementById('resultCard'),
  resultSub: document.getElementById('resultSub'),
  resultClusterTag: document.getElementById('resultClusterTag'),
  resultHeroName: document.getElementById('resultHeroName'),
  resultHeroImage: document.getElementById('resultHeroImage'),

  // NEW: hero copy + sections
  resultHeroCopy: document.getElementById('resultHeroCopy'),
  resultPersonalityTitle: document.getElementById('resultPersonalityTitle'),
  resultPersonalityBody: document.getElementById('resultPersonalityBody'),
  resultScenes: document.getElementById('resultScenes'),
  resultTips: document.getElementById('resultTips'),
  resultJobs: document.getElementById('resultJobs'),
  resultReactions: document.getElementById('resultReactions'),

  // share
  resultShareImage: document.getElementById('resultShareImage'),
  downloadShareButton: document.getElementById('downloadShareButton'),
  shareLineButton: document.getElementById('shareLineButton'),
  shareWebButton: document.getElementById('shareWebButton'),
  shareXButton: document.getElementById('shareXButton'),
  shareCopyButton: document.getElementById('shareCopyButton'),

  // optional scores
  resultScores: document.getElementById('resultScores'),
  unansweredAlert: document.getElementById('unansweredAlert'),

  /* ▼ 追加：基本情報の参照 */
  demographicsGender: document.getElementById('demographicsGender'),
  demographicsAge: document.getElementById('demographicsAge'),
  demographicsMbti: document.getElementById('demographicsMbti'),
  /* ▲ 追加ここまで */
};

init();

/* ---------- boot & helpers ---------- */

function resolveLiffId() {
  if (window.__LIFF_ID__) return String(window.__LIFF_ID__).trim();
  const meta = document.querySelector('meta[name="liff-id"]');
  return meta?.content?.trim() || '';
}

function resolveBaseUrl() {
  if (window.__APP_BASE_URL__) return String(window.__APP_BASE_URL__).trim();
  const meta = document.querySelector('meta[name="app-base-url"]');
  const v = (meta?.content || '').trim();
  return v || window.location.origin;
}

function getSessionParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('session') || undefined;
}

async function ensureLiff() {
  if (!window.liff) {
    console.warn('[liff] sdk not found, continue with debug profile');
    return;
  }
  await window.liff.init({ liffId: LIFF_ID || undefined, withLoginOnExternalBrowser: true });
  if (!window.liff.isLoggedIn()) {
    window.liff.login();
    await new Promise(() => {});
  }
  const profile = await window.liff.getProfile();
  appState.profile = {
    userId: profile.userId,
    displayName: profile.displayName || 'LINEユーザー',
  };
}

/* ---------- UI boot ---------- */

async function init() {
  bindFooterActions();
  bindLikertShortcuts();
  /* ▼ 追加：プルダウン初期化 */
  bindDemographics();
  /* ▲ 追加ここまで */
  renderSkeleton();
  try {
    await ensureLiff();
    await loadQuestions();
  } catch (error) {
    console.error('[liff] init failed', error);
    showToast('LIFFの初期化に失敗しました。時間をおいて再試行してください', true);
    showErrorCard('LIFFの初期化に失敗しました。電波の良い場所で再試行してください。');
  }
}

function bindFooterActions() {
  elements.submitButton.addEventListener('click', onSubmit);
  elements.retryButton.addEventListener('click', () => {
    hideToast();
    elements.retryButton.classList.add('hidden');
    renderSkeleton();
    loadQuestions();
  });
  elements.shareButton.addEventListener('click', handlePrimaryShare);
  elements.retakeButton?.addEventListener('click', retakeDiagnosis);
  elements.reviewButton?.addEventListener('click', toggleReview);
  elements.downloadShareButton?.addEventListener('click', handleDownloadShareCard);
  bindShareButtons();
}

function bindShareButtons() {
  elements.shareLineButton?.addEventListener('click', handleLineShare);
  elements.shareWebButton?.addEventListener('click', handleWebShare);
  elements.shareXButton?.addEventListener('click', handleXShare);
  elements.shareCopyButton?.addEventListener('click', handleCopyLink);
}

/* ---------- load & render ---------- */

function renderSkeleton() {
  elements.questions.innerHTML = '';
  elements.questions.setAttribute('aria-busy', 'true');
  const card = document.createElement('section');
  card.className = 'question-card skeleton';
  card.innerHTML = `
    <div class="skeleton-line skeleton-title"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line"></div>
  `;
  elements.questions.appendChild(card);
}

async function loadQuestions() {
  const qs = QUESTIONS.map((item, index) => ({
    code: item.id || item.code || `Q${index + 1}`,
    text: String(item.text ?? ''),
  }));
  if (!qs.length) {
    throw new Error('診断データが取得できませんでした');
  }

  appState.version = QUESTION_VERSION;
  appState.questions = qs;
  appState.answers.clear();
  appState.submitting = false;
  appState.result = null;
  appState.reviewing = false;

  elements.submitContent.textContent = '送信する';
  elements.retryButton.classList.add('hidden');
  elements.submitButton.classList.remove('hidden');
  elements.shareButton.classList.add('hidden');
  elements.resultActions?.classList.add('hidden');
  elements.resultCard.classList.add('hidden');
  elements.loadError?.classList.add('hidden');
  if (elements.loadError) elements.loadError.textContent = '';

  elements.questions.removeAttribute('aria-busy');
  renderQuestions();
  updateProgress();
  hideToast();
}

function renderQuestions() {
  elements.questions.innerHTML = '';
  elements.questions.classList.remove('hidden');
  elements.resultCard.classList.add('hidden');

  appState.questions.forEach((question, index) => {
    const card = document.createElement('section');
    card.className = 'question-card';
    card.dataset.questionCode = question.code;

    const heading = document.createElement('h2');
    const headingId = `${question.code}-title`;
    heading.id = headingId;
    heading.textContent = `${index + 1}. ${question.text}`;
    card.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'choices likert-scale';
    list.dataset.likertContainer = 'true';
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-labelledby', headingId);
    list.tabIndex = 0;

    const previousSelection = appState.answers.get(question.code);

    LIKERT_OPTIONS.forEach((option) => {
      const choiceId = `${question.code}-scale-${option.value}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'likert-choice';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = question.code;
      input.id = choiceId;
      input.value = String(option.value);
      input.required = true;
      input.className = 'likert-input';
      if (Number(previousSelection) === option.value) input.checked = true;
      input.addEventListener('change', () => handleAnswerChange(question.code, option.value));

      const label = document.createElement('label');
      label.setAttribute('for', choiceId);
      label.className = `likert-option size-${option.size}`;
      label.setAttribute('aria-label', `${option.label} (${option.value})`);

      const diamond = document.createElement('span');
      diamond.className = 'likert-diamond';
      diamond.setAttribute('aria-hidden', 'true');

      label.appendChild(diamond);
      wrapper.appendChild(input);
      wrapper.appendChild(label);
      list.appendChild(wrapper);
    });

    card.appendChild(list);

    const legend = document.createElement('div');
    legend.className = 'likert-legend';
    legend.setAttribute('aria-hidden', 'true');

    const legendLeft = document.createElement('span');
    legendLeft.className = 'legend-left';
    legendLeft.textContent = 'とてもそう思う';

    const legendBar = document.createElement('span');
    legendBar.className = 'legend-bar';
    legendBar.setAttribute('role', 'presentation');

    const legendRight = document.createElement('span');
    legendRight.className = 'legend-right';
    legendRight.textContent = '全くそう思わない';

    legend.appendChild(legendLeft);
    legend.appendChild(legendBar);
    legend.appendChild(legendRight);

    card.appendChild(legend);
    elements.questions.appendChild(card);
  });
}

/* ---------- state & submit ---------- */

function handleAnswerChange(code, scale) {
  const numericScale = Number(scale);
  if (!Number.isFinite(numericScale)) return;
  appState.answers.set(code, numericScale);
  updateProgress();
}

function updateProgress() {
  const total = appState.questions.length || 25;
  const answered = appState.answers.size;
  const remaining = Math.max(total - answered, 0);

  elements.answeredCount.textContent = String(answered);
  elements.remainingCount.textContent = String(remaining);

  const percent = total === 0 ? 0 : (answered / total) * 100;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressFill.parentElement?.setAttribute('aria-valuenow', String(answered));
  elements.progressFill.parentElement?.setAttribute('aria-valuemax', String(total));

  /* ▼ 変更：基本情報が揃うまで送信不可 */
  const canSubmit =
    answered === total &&
    total > 0 &&
    !appState.submitting &&
    isDemographicsComplete();

  elements.submitButton.disabled = !canSubmit;
  /* ▲ 変更ここまで */

  updateUnansweredAlert();
}

function updateUnansweredAlert() {
  const total = appState.questions.length;
  if (!total) return elements.unansweredAlert.classList.add('hidden');
  if (appState.answers.size === total) return elements.unansweredAlert.classList.add('hidden');

  const missing = appState.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => !appState.answers.has(q.code))
    .map(({ i }) => `Q${i + 1}`);

  if (missing.length) {
    elements.unansweredAlert.textContent = `未回答：${missing.join('、')}`;
    elements.unansweredAlert.classList.remove('hidden');
  } else {
    elements.unansweredAlert.classList.add('hidden');
  }
}

async function onSubmit() {
  /* ▼ 追加：基本情報未選択のブロック */
  if (!isDemographicsComplete()) {
    showToast('性別・年齢・MBTIタイプを選択してください', true);
    return;
  }
  /* ▲ 追加ここまで */

  if (appState.submitting || appState.answers.size !== appState.questions.length) {
    updateUnansweredAlert();
    showToast('未回答の質問があります', true);
    return;
  }

  appState.submitting = true;
  elements.submitButton.disabled = true;
  elements.submitContent.innerHTML = '<span class="spinner" aria-hidden="true"></span>';

  try {
    const payload = {
      userId: appState.profile.userId,
      sessionId: appState.sessionId,
      version: QUESTION_VERSION,
      answers: Array.from(appState.answers.entries()).map(([code, scale]) => ({
        code, scale, scaleMax: 6,
      })),
      /* ▼ 追加：送信に同梱（サーバ保存は任意） */
      meta: { liff: true, demographics: { ...appState.demographics } },
      /* ▲ 追加ここまで */
    };

    const response = await fetch('/api/diagnosis/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await createFetchError(response);
      console.error('[diagnosis] submit failed', response.status, error.message);
      alert('Submit failed. Please try again.');
      throw error;
    }

    const backend = await response.json();
    appState.sessionId = backend.sessionId || appState.sessionId;

    // ---- 正規化：サーバーがslug等を返す前提。必要に応じてローカル辞書で補完 ----
    const slug = backend?.heroSlug || backend?.hero?.slug || '';
    const profile = slug ? getHeroProfile(slug) : { name: backend?.hero?.name || 'ヒーロータイプ', avatarUrl: backend?.hero?.avatarUrl };
    const narrative = slug ? getHeroNarrative(slug) : (backend?.narrative ?? {});
    const clusterKey = backend?.cluster?.key ?? backend?.cluster ?? profile?.cluster ?? '';
    const share = backend?.share ?? {};
    const shareUrl = share.url ?? `${BASE_URL}/share/${backend?.sessionId ?? appState.sessionId ?? ''}`;
    const cardImageUrl = share.cardImageUrl ?? profile.avatarUrl;

    const normalized = {
      sessionId: backend?.sessionId ?? appState.sessionId,
      cluster: { key: clusterKey, label: getClusterLabel?.(clusterKey) || '' },
      hero: { slug, name: profile.name, avatarUrl: profile.avatarUrl },
      share: {
        url: shareUrl,
        cardImageUrl,
        copy: {
          headline: share.copy?.headline ?? `あなたは${profile.name}！`,
          summary: share.copy?.summary ?? narrative?.hero_copy ?? '',
        },
      },
      narrative, // ← hero_copy / personality / scenes / tips / jobs.suited[] / reactions[]
      scores: backend?.scores ?? {},
    };

    appState.result = normalized;
    showResult(normalized);
    hideToast();
  } catch (error) {
    console.error('[diagnosis] submit failed', error);
    if (!error || !error.__alertShown) alert('Submit failed. Please try again.');
    showToast(error.message || '送信に失敗しました', true, error.errorId);
    elements.retryButton.classList.remove('hidden');
  } finally {
    appState.submitting = false;
    elements.submitContent.textContent = '送信する';
    updateProgress();
  }
}

/* ---------- result & feedback ---------- */

function showResult(result) {
  elements.questions.classList.add('hidden');
  elements.unansweredAlert.classList.add('hidden');
  elements.resultCard.classList.remove('hidden');
  elements.resultActions?.classList.remove('hidden');
  elements.submitButton.classList.add('hidden');
  elements.retryButton.classList.add('hidden');
  elements.shareButton.classList.remove('hidden');
  elements.shareButton.disabled = false;

  const displayName = appState.profile.displayName || 'あなた';
  elements.resultSub.textContent = `${displayName}、結果をまとめたよ。`;

  const headline = result.share.copy.headline || `あなたは${result.hero.name}！`;
  elements.resultHeroName.textContent = headline;

  elements.resultClusterTag.textContent = result.cluster.label ? `#${result.cluster.label}` : '';
  elements.resultHeroImage.src = result.hero.avatarUrl || 'https://placehold.co/512x512?text=HERO';
  elements.resultHeroImage.alt = result.hero.name || 'ヒーロー';

  // NEW: 偉人コピー
  elements.resultHeroCopy.textContent = result.narrative?.hero_copy ?? '';

  // NEW: 個性
  elements.resultPersonalityTitle.textContent = result.narrative?.personality?.title ?? '';
  fillParagraphs(elements.resultPersonalityBody, result.narrative?.personality?.paragraphs ?? []);

  // NEW: 活躍シーン / 成長のヒント / 化学反応
  renderList(elements.resultScenes, result.narrative?.scenes ?? []);
  renderList(elements.resultTips, result.narrative?.tips ?? []);
  renderOrdered(elements.resultReactions, result.narrative?.reactions ?? []);

  // NEW: 職業（name — blurb）
  renderJobs(elements.resultJobs, result.narrative?.jobs?.suited ?? []);

  // シェア
  elements.resultShareImage.src = result.share.cardImageUrl || result.hero.avatarUrl || '';
  elements.resultShareImage.alt = `${result.hero.name}のシェアカード`;
  elements.downloadShareButton.disabled = !result.share.cardImageUrl;

  // スコア（任意）
  renderScores(result.scores);
}

function showErrorCard(message) {
  elements.questions.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'question-card';
  card.innerHTML = `<p>${message}</p>`;
  elements.questions.appendChild(card);
}

/* ---------- small render utils ---------- */

function renderList(target, items) {
  if (!target) return;
  target.innerHTML = '';
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    target.appendChild(createLi('準備中'));
    return;
  }
  list.forEach((t) => target.appendChild(createLi(t)));
}

function renderOrdered(target, items) {
  if (!target) return;
  target.innerHTML = '';
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    const li = document.createElement('li');
    li.textContent = '準備中';
    target.appendChild(li);
    return;
  }
  list.forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    target.appendChild(li);
  });
}

function renderJobs(target, jobs) {
  if (!target) return;
  target.innerHTML = '';
  const arr = Array.isArray(jobs) ? jobs : [];
  if (!arr.length) {
    target.appendChild(createLi('準備中'));
    return;
  }
  arr.forEach(({ name, blurb }) => {
    const li = document.createElement('li');
    const wrap = document.createElement('div');
    wrap.className = 'job';
    const n = document.createElement('span');
    n.className = 'job__name';
    n.textContent = name || '';
    const sep = document.createTextNode(' — ');
    const b = document.createElement('span');
    b.className = 'job__blurb';
    b.textContent = blurb || '';
    wrap.append(n, sep, b);
    li.appendChild(wrap);
    target.appendChild(li);
  });
}

function fillParagraphs(container, paras) {
  if (!container) return;
  container.innerHTML = '';
  (Array.isArray(paras) ? paras : []).forEach((t) => {
    const p = document.createElement('p');
    p.textContent = t;
    container.appendChild(p);
  });
}

function createLi(text) {
  const li = document.createElement('li');
  li.textContent = text;
  return li;
}

/* ---------- scores (optional) ---------- */

function renderScores(scores) {
  if (!elements.resultScores) return;
  elements.resultScores.innerHTML = '';
  if (!scores || typeof scores !== 'object') {
    elements.resultScores.textContent = 'スコアを集計中です。';
    return;
  }
  const groups = [
    { key: 'MBTI', label: 'MBTIバランス' },
    { key: 'WorkStyle', label: 'ワークスタイル' },
    { key: 'Motivation', label: 'モチベーション' },
  ];
  groups.forEach(({ key, label }) => {
    const values = scores[key] ?? {};
    const entries = Object.entries(values);
    if (!entries.length) return;
    const section = document.createElement('div');
    section.className = 'score-block';

    const heading = document.createElement('h4');
    heading.textContent = label;
    section.appendChild(heading);

    const list = document.createElement('dl');
    list.className = 'score-list';

    entries.forEach(([itemKey, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = itemKey;
      const dd = document.createElement('dd');
      dd.textContent = formatScoreValue(value);
      list.appendChild(dt);
      list.appendChild(dd);
    });

    section.appendChild(list);
    elements.resultScores.appendChild(section);
  });
}

function formatScoreValue(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0';
  if (Math.abs(numeric - Math.round(numeric)) < 0.01) return String(Math.round(numeric));
  return numeric.toFixed(2);
}

/* ---------- share ---------- */

function bindLikertShortcuts() {
  if (bindLikertShortcuts._bound) return;
  bindLikertShortcuts._bound = true;
  document.addEventListener('keydown', (event) => {
    if (!LIKERT_SHORTCUT_KEYS.has(event.key)) return;
    const active = document.activeElement;
    if (!active || typeof active.closest !== 'function') return;
    const container = active.closest('[data-likert-container]');
    if (!container) return;
    const input = container.querySelector(`input[value="${event.key}"]`);
    if (!input) return;
    event.preventDefault();
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  });
}

function shortenMessage(message) {
  const text = String(message || '');
  if (text.length <= 80) return text;
  return `…${text.slice(-80)}`;
}

function showToast(message, isError = false, errorId) {
  const displayMessage = shortenMessage(message);
  elements.toast.textContent = errorId ? `${displayMessage} (ID: ${errorId})` : displayMessage;
  elements.toast.classList.toggle('error', Boolean(isError));
  elements.toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 4000);
}

function hideToast() {
  elements.toast.classList.add('hidden');
  if (showToast._timer) clearTimeout(showToast._timer);
}

async function createFetchError(response) {
  let message = `通信に失敗しました (${response.status})`;
  let errorId;
  const text = await response.text();
  try {
    const data = text ? JSON.parse(text) : {};
    if (data?.errorId) errorId = data.errorId;
    if (data?.message) message = data.message;
    else if (data?.error) message = data.error;
  } catch {
    message = text || message;
  }
  const error = new Error(message);
  if (errorId) error.errorId = errorId;
  error.__alertShown = true;
  return error;
}

/* ---------- demographics helpers（追加） ---------- */

function populateSelect(selectEl, options) {
  if (!selectEl) return;
  [...selectEl.querySelectorAll('option[data-auto]')].forEach((opt) => opt.remove());
  for (const { value, label } of options) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    o.dataset.auto = 'true';
    selectEl.appendChild(o);
  }
}

function bindDemographics() {
  populateSelect(elements.demographicsGender, GENDER_OPTIONS);
  populateSelect(elements.demographicsAge, AGE_OPTIONS);
  populateSelect(elements.demographicsMbti, MBTI_OPTIONS);

  elements.demographicsGender?.addEventListener('change', (e) => {
    appState.demographics.gender = e.target.value || '';
    updateProgress();
  });
  elements.demographicsAge?.addEventListener('change', (e) => {
    appState.demographics.age = e.target.value || '';
    updateProgress();
  });
  elements.demographicsMbti?.addEventListener('change', (e) => {
    appState.demographics.mbti = e.target.value || '';
    updateProgress();
  });
}

function isDemographicsComplete() {
  const { gender, age, mbti } = appState.demographics;
  return Boolean(gender && age && mbti);
}

/* ---------- primary share handlers ---------- */

async function handlePrimaryShare() {
  if (!appState.result) return showToast('共有できる結果がありません', true);
  if (window.liff?.shareTargetPicker) return void (await handleLineShare());
  if (navigator.share) return void (await handleWebShare());
  await handleCopyLink();
}

async function handleLineShare() {
  const share = appState.result?.share;
  if (!share) return showToast('シェア情報が準備中です', true);
  if (!window.liff?.shareTargetPicker) return showToast('LINEアプリからのシェアに対応していません', true);
  const text = `${share.copy.headline}\n${share.copy.summary}\n${share.url}`;
  try {
    await window.liff.shareTargetPicker([{ type: 'text', text }]);
    showToast('LINEにシェアしました');
  } catch (error) {
    if (error?.code !== 'USER_CANCEL') {
      console.error('[share] line error', error);
      showToast('LINEシェアに失敗しました', true);
    }
  }
}

async function handleWebShare() {
  const share = appState.result?.share;
  if (!share) return showToast('シェア情報が準備中です', true);
  if (!navigator.share) return void (await handleCopyLink());
  try {
    await navigator.share({ title: share.copy.headline, text: share.copy.summary, url: share.url });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('[share] web error', error);
      showToast('端末の共有に失敗しました', true);
    }
  }
}

function handleXShare() {
  const share = appState.result?.share;
  if (!share) return showToast('シェア情報が準備中です', true);
  const text = `${share.copy.headline}\n${share.copy.summary}`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(share.url)}`;
  window.open(intent, '_blank', 'noopener');
}

async function handleCopyLink() {
  const share = appState.result?.share;
  if (!share) return showToast('シェア情報が準備中です', true);
  try {
    await navigator.clipboard.writeText(share.url);
    showToast('リンクをコピーしました');
  } catch (error) {
    console.error('[share] copy error', error);
    showToast('リンクのコピーに失敗しました', true);
  }
}

function handleDownloadShareCard() {
  const imageUrl = appState.result?.share?.cardImageUrl;
  if (!imageUrl) return showToast('共有カードがまだありません', true);
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = 'diagnosis-share.png';
  link.rel = 'noopener';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ---------- retake / review ---------- */

function retakeDiagnosis() {
  appState.answers.clear();
  appState.result = null;
  appState.reviewing = false;
  appState.sessionId = undefined;
  elements.resultCard.classList.add('hidden');
  elements.resultActions?.classList.add('hidden');
  elements.shareButton.classList.add('hidden');
  elements.submitButton.classList.remove('hidden');
  elements.questions.classList.remove('hidden');
  renderQuestions();
  updateProgress();
  elements.questions.scrollTop = 0;
}

function toggleReview() {
  if (!appState.result) return;
  appState.reviewing = !appState.reviewing;
  if (appState.reviewing) {
    elements.questions.classList.remove('hidden');
    elements.reviewButton.textContent = '結果に戻る';
    elements.questions.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    elements.questions.classList.add('hidden');
    elements.reviewButton.textContent = '回答を見直す';
    elements.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
