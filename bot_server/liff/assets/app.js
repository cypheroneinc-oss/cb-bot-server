// LIFF + 診断UI ロジック（repo質問 / DB非依存）
const LIFF_ID = resolveLiffId();
const BASE_URL = resolveBaseUrl();

const CLUSTER_LABELS = {
  challenge: 'チャレンジ',
  creative: 'クリエイティブ',
  support: 'サポート',
  strategy: 'ストラテジー',
};

const LIKERT_OPTIONS = [
  { value: 1, label: 'Strongly Agree', size: 'large' },
  { value: 2, label: 'Agree', size: 'medium' },
  { value: 3, label: 'Slightly Agree', size: 'small' },
  { value: 4, label: 'Slightly Disagree', size: 'small' },
  { value: 5, label: 'Disagree', size: 'medium' },
  { value: 6, label: 'Strongly Disagree', size: 'large' },
];

const LIKERT_SHORTCUT_KEYS = new Set(['1', '2', '3', '4', '5', '6']);

const appState = {
  version: null,
  questions: [],
  answers: new Map(),              // Map<code, key>
  sessionId: getSessionParam(),
  submitting: false,
  profile: { userId: 'debug-user', displayName: 'Debug User' },
};

const elements = {
  questions: document.getElementById('questions'),
  progressFill: document.getElementById('progressFill'),
  answeredCount: document.getElementById('answeredCount'),
  remainingCount: document.getElementById('remainingCount'),
  submitButton: document.getElementById('submitButton'),
  submitContent: document.getElementById('submitContent'),
  shareButton: document.getElementById('shareButton'),
  toast: document.getElementById('toast'),
  retryButton: document.getElementById('retryButton'),
  unansweredAlert: document.getElementById('unansweredAlert'),
  resultCard: document.getElementById('resultCard'),
  resultUser: document.getElementById('resultUser'),
  resultCluster: document.getElementById('resultCluster'),
  resultHero: document.getElementById('resultHero'),
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
  console.log('[liff] init OK', { inClient: window.liff.isInClient(), loggedIn: window.liff.isLoggedIn() });
  if (!window.liff.isLoggedIn()) {
    window.liff.login();
    // halt further execution on this page load
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
  elements.shareButton.addEventListener('click', () => {
    if (!appState.sessionId) return;
    window.location.href = `${BASE_URL}/share/${appState.sessionId}`;
  });
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
  try {
    const payload = await fetchDiagnosisPayload();
    const qs = Array.isArray(payload?.questions) ? payload.questions : [];
    if (!qs.length) throw new Error('診断データが取得できませんでした');

    appState.version = payload.version ?? null;
    appState.questions = qs;
    appState.answers.clear();
    appState.submitting = false;

    elements.submitContent.textContent = '送信する';
    elements.retryButton.classList.add('hidden');
    elements.submitButton.classList.remove('hidden');
    elements.shareButton.classList.add('hidden');

    elements.questions.removeAttribute('aria-busy');
    renderQuestions();
    updateProgress();
    hideToast();
  } catch (error) {
    console.error('[diagnosis] load failed', error);
    elements.questions.innerHTML = '';
    showErrorCard('通信に失敗しました。電波の良い場所で再試行してください。');
    showToast(error.message || '読み込みに失敗しました', true);
    elements.retryButton.classList.remove('hidden');
  }
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
      if (Number(previousSelection) === option.value) {
        input.checked = true;
      }
      input.addEventListener('change', () => handleAnswerChange(question.code, option.value));

      const label = document.createElement('label');
      label.setAttribute('for', choiceId);
      label.className = `likert-option size-${option.size}`;
      label.setAttribute('aria-label', `${option.label} (${option.value})`);

      const diamond = document.createElement('span');
      diamond.className = 'likert-diamond';
      diamond.setAttribute('aria-hidden', 'true');

      const diamondValue = document.createElement('span');
      diamondValue.className = 'likert-diamond-value';
      diamondValue.textContent = String(option.value);
      diamond.appendChild(diamondValue);

      const caption = document.createElement('span');
      caption.className = 'likert-caption';
      caption.textContent = option.label;

      label.appendChild(diamond);
      label.appendChild(caption);

      wrapper.appendChild(input);
      wrapper.appendChild(label);
      list.appendChild(wrapper);
    });

    card.appendChild(list);
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

  const canSubmit = answered === total && total > 0 && !appState.submitting;
  elements.submitButton.disabled = !canSubmit;

  updateUnansweredAlert();
}

function updateUnansweredAlert() {
  const total = appState.questions.length;
  if (!total) {
    elements.unansweredAlert.classList.add('hidden');
    return;
  }
  if (appState.answers.size === total) {
    elements.unansweredAlert.classList.add('hidden');
    return;
  }
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
      version: appState.version,
      answers: Array.from(appState.answers.entries()).map(([code, scale]) => ({
        code,
        scale,
        scaleMax: 6,
      })),
    };

    const response = await fetch('/api/diagnosis/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await createFetchError(response);
    }

    const result = await response.json();
    appState.sessionId = result.sessionId || appState.sessionId;
    showResult(result);
    hideToast();
  } catch (error) {
    console.error('[diagnosis] submit failed', error);
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
  elements.submitButton.classList.add('hidden');
  elements.retryButton.classList.add('hidden');
  elements.shareButton.classList.remove('hidden');

  const payload = result.result ?? result;
  const cluster = payload?.cluster ?? result.cluster;
  const heroSlug = payload?.heroSlug ?? result.heroSlug;

  const clusterLabel = cluster ? `タイプ：${CLUSTER_LABELS[cluster] ?? cluster}` : '';
  const heroLabel = heroSlug ? `推しキャラ：${heroSlug}` : '';

  elements.resultUser.textContent = `${appState.profile.displayName} さん、おつかれさま。`;
  elements.resultCluster.textContent = clusterLabel;
  elements.resultHero.textContent = heroLabel;

  elements.shareButton.disabled = !appState.sessionId;
}

function showErrorCard(message) {
  elements.questions.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'question-card';
  card.innerHTML = `<p>${message}</p>`;
  elements.questions.appendChild(card);
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

/* ---------- fetch utils ---------- */

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
  return error;
}

async function fetchDiagnosisPayload() {
  const response = await fetch('/api/diagnosis', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const text = await response.text();
  console.log('[diagnosis] GET /api/diagnosis', response.status, text.slice(0, 200));
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('[diagnosis] JSON parse error', e);
    throw new Error('診断データの形式が不正です');
  }
}

function shortenMessage(message) {
  const text = String(message || '');
  if (text.length <= 80) return text;
  return `…${text.slice(-80)}`;
}
