// LIFF + 診断UI ロジック（repo質問 / DB非依存）
const LIFF_ID = resolveLiffId();
const BASE_URL = resolveBaseUrl();

const QUESTION_VERSION = 2;

const CLUSTER_LABELS = {
  challenge: 'チャレンジ',
  creative: 'クリエイティブ',
  support: 'サポート',
  strategy: 'ストラテジー',
};

const LIKERT_OPTIONS = [
  { value: 1, label: 'とてもそう思う', size: 'large' },
  { value: 2, label: 'かなりそう思う', size: 'medium' },
  { value: 3, label: '少しそう思う', size: 'small' },
  { value: 4, label: '少しそう思わない', size: 'small' },
  { value: 5, label: 'かなりそう思わない', size: 'medium' },
  { value: 6, label: '全くそう思わない', size: 'large' },
];

const LIKERT_SHORTCUT_KEYS = new Set(['1', '2', '3', '4', '5', '6']);
const QUESTION_SOURCE_PATHS = ['./data/questions.v1.json', '../data/questions.v1.json'];

const appState = {
  version: QUESTION_VERSION,
  questions: [],
  answers: new Map(),              // Map<code, scale>
  sessionId: getSessionParam(),
  submitting: false,
  profile: { userId: 'debug-user', displayName: 'Debug User' },
  result: null,
  reviewing: false,
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
  unansweredAlert: document.getElementById('unansweredAlert'),
  resultCard: document.getElementById('resultCard'),
  resultSub: document.getElementById('resultSub'),
  resultClusterTag: document.getElementById('resultClusterTag'),
  resultHeroName: document.getElementById('resultHeroName'),
  resultHeroImage: document.getElementById('resultHeroImage'),
  resultSummary: document.getElementById('resultSummary'),
  resultStrengths: document.getElementById('resultStrengths'),
  resultMisfit: document.getElementById('resultMisfit'),
  resultHowToUse: document.getElementById('resultHowToUse'),
  resultNextAction: document.getElementById('resultNextAction'),
  resultScores: document.getElementById('resultScores'),
  resultShareImage: document.getElementById('resultShareImage'),
  downloadShareButton: document.getElementById('downloadShareButton'),
  shareLineButton: document.getElementById('shareLineButton'),
  shareWebButton: document.getElementById('shareWebButton'),
  shareXButton: document.getElementById('shareXButton'),
  shareCopyButton: document.getElementById('shareCopyButton'),
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
  try {
    const payload = await fetchDiagnosisPayload();
    const qs = Array.isArray(payload?.questions) ? payload.questions : [];
    if (!qs.length) throw new Error('診断データが取得できませんでした');

    appState.version = payload.version ?? QUESTION_VERSION;
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
    elements.loadError.classList.add('hidden');
    elements.loadError.textContent = '';

    elements.questions.removeAttribute('aria-busy');
    renderQuestions();
    updateProgress();
    hideToast();
  } catch (error) {
    console.error('[diagnosis] load failed', error);
    elements.questions.removeAttribute('aria-busy');
    elements.loadError.textContent = error.message || '質問データの読み込みに失敗しました。';
    elements.loadError.classList.remove('hidden');
    elements.submitButton.disabled = true;
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

function showResult(rawResult) {
  const normalized = normalizeResult(rawResult);
  appState.result = normalized;
  appState.sessionId = normalized.sessionId ?? appState.sessionId;
  appState.reviewing = false;

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

  const headline = normalized.share.copy.headline || `あなたは${normalized.hero.name}！`;
  elements.resultHeroName.textContent = headline;
  elements.resultClusterTag.textContent = normalized.cluster.label
    ? `#${normalized.cluster.label}`
    : '';

  elements.resultHeroImage.src = normalized.hero.avatarUrl;
  elements.resultHeroImage.alt = normalized.hero.name;
  elements.resultSummary.textContent = normalized.narrative.summary1line;

  renderNarrativeList(elements.resultStrengths, normalized.narrative.strengths);
  renderNarrativeList(elements.resultMisfit, normalized.narrative.misfit_env);
  renderNarrativeList(elements.resultHowToUse, normalized.narrative.how_to_use);
  renderNarrativeList(elements.resultNextAction, normalized.narrative.next_action);
  renderScores(normalized.scores);

  elements.resultShareImage.src = normalized.share.cardImageUrl;
  elements.resultShareImage.alt = `${normalized.hero.name}のシェアカード`;
  elements.downloadShareButton.disabled = !normalized.share.cardImageUrl;
  elements.reviewButton.textContent = '回答を見直す';
  elements.questions.classList.add('hidden');
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

function normalizeResult(result) {
  const cluster = result?.cluster ?? {};
  const hero = result?.hero ?? {};
  const share = result?.share ?? {};
  const narrative = result?.narrative ?? {};
  const scores = result?.scores ?? {};

  const clusterKey = cluster.key ?? cluster ?? null;
  const clusterLabel = cluster.label ?? CLUSTER_LABELS[clusterKey] ?? '';
  const heroSlug = hero.slug ?? result?.heroSlug ?? '';
  const heroName = hero.name ?? 'ヒーロータイプ';
  const heroImage = hero.avatarUrl ?? 'https://placehold.co/512x512?text=HERO';
  const shareCopy = share.copy ?? {};
  const shareUrl = share.url ?? `${BASE_URL}/share/${result?.sessionId ?? appState.sessionId ?? ''}`;
  const cardImageUrl = share.cardImageUrl ?? heroImage;
  const summaryText = narrative.summary1line ?? shareCopy.summary ?? '';

  return {
    sessionId: result?.sessionId ?? appState.sessionId,
    cluster: { key: clusterKey, label: clusterLabel },
    hero: { slug: heroSlug, name: heroName, avatarUrl: heroImage },
    share: {
      url: shareUrl,
      cardImageUrl,
      copy: {
        headline: shareCopy.headline ?? `あなたは${heroName}！`,
        summary: shareCopy.summary ?? summaryText,
      },
    },
    narrative: {
      summary1line: summaryText,
      strengths: Array.isArray(narrative.strengths) ? narrative.strengths : [],
      misfit_env: Array.isArray(narrative.misfit_env) ? narrative.misfit_env : [],
      how_to_use: Array.isArray(narrative.how_to_use) ? narrative.how_to_use : [],
      next_action: Array.isArray(narrative.next_action) ? narrative.next_action : [],
    },
    scores,
  };
}

function renderNarrativeList(target, items) {
  if (!target) return;
  target.innerHTML = '';
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    const placeholder = document.createElement('li');
    placeholder.textContent = '準備中';
    target.appendChild(placeholder);
    return;
  }
  list.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    target.appendChild(li);
  });
}

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
    if (!entries.length) {
      return;
    }
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
  if (Math.abs(numeric - Math.round(numeric)) < 0.01) {
    return String(Math.round(numeric));
  }
  return numeric.toFixed(2);
}

async function handlePrimaryShare() {
  if (!appState.result) {
    showToast('共有できる結果がありません', true);
    return;
  }
  if (window.liff?.shareTargetPicker) {
    await handleLineShare();
    return;
  }
  if (navigator.share) {
    await handleWebShare();
    return;
  }
  await handleCopyLink();
}

async function handleLineShare() {
  const share = appState.result?.share;
  if (!share) {
    showToast('シェア情報が準備中です', true);
    return;
  }
  if (!window.liff?.shareTargetPicker) {
    showToast('LINEアプリからのシェアに対応していません', true);
    return;
  }
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
  if (!share) {
    showToast('シェア情報が準備中です', true);
    return;
  }
  if (!navigator.share) {
    await handleCopyLink();
    return;
  }
  try {
    await navigator.share({
      title: share.copy.headline,
      text: share.copy.summary,
      url: share.url,
    });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.error('[share] web error', error);
      showToast('端末の共有に失敗しました', true);
    }
  }
}

function handleXShare() {
  const share = appState.result?.share;
  if (!share) {
    showToast('シェア情報が準備中です', true);
    return;
  }
  const text = `${share.copy.headline}\n${share.copy.summary}`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
    share.url
  )}`;
  window.open(intent, '_blank', 'noopener');
}

async function handleCopyLink() {
  const share = appState.result?.share;
  if (!share) {
    showToast('シェア情報が準備中です', true);
    return;
  }
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
  if (!imageUrl) {
    showToast('共有カードがまだありません', true);
    return;
  }
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = 'diagnosis-share.png';
  link.rel = 'noopener';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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
  if (!appState.result) {
    return;
  }
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
  const questions = await fetchLocalQuestions();
  return { version: QUESTION_VERSION, questions };
}

async function fetchLocalQuestions() {
  let lastError;
  for (const path of QUESTION_SOURCE_PATHS) {
    try {
      const response = await fetch(path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}: ${path}`);
        continue;
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('質問データの形式が不正です');
      }
      return data.map((item, index) => ({
        code: item.code || item.id || `Q${index + 1}`,
        text: String(item.text ?? ''),
      }));
    } catch (error) {
      lastError = error;
      console.warn('[diagnosis] failed to load questions from', path, error);
    }
  }
  throw lastError || new Error('質問データを読み込めませんでした');
}

function shortenMessage(message) {
  const text = String(message || '');
  if (text.length <= 80) return text;
  return `…${text.slice(-80)}`;
}
