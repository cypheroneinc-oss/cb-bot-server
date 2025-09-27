const LIFF_ID = window.__LIFF_ID__;
const BASE_URL = window.__APP_BASE_URL__ || window.location.origin;

const questionsContainer = document.getElementById('questions');
const progressFill = document.getElementById('progressFill');
const answeredCountEl = document.getElementById('answeredCount');
const remainingCountEl = document.getElementById('remainingCount');
const submitButton = document.getElementById('submitButton');
const submitContent = document.getElementById('submitContent');
const shareButton = document.getElementById('shareButton');
const toastEl = document.getElementById('toast');
const retryButton = document.getElementById('retryButton');
const unansweredAlert = document.getElementById('unansweredAlert');
const resultCard = document.getElementById('resultCard');
const resultUser = document.getElementById('resultUser');
const resultCluster = document.getElementById('resultCluster');
const resultHero = document.getElementById('resultHero');

const DEFAULT_TOTAL = 25;
let totalQuestions = DEFAULT_TOTAL;

shareButton.disabled = true;

let liffProfile = { userId: 'debug-user', displayName: 'Debug User' };
let fetchedQuestions = [];
const answers = new Map();
let currentSessionId = getSessionParam();
let isSubmitting = false;

init();

async function init() {
  try {
    await ensureLiff();
  } catch (error) {
    console.error('LIFF init error', error);
    showToast('LIFFの初期化に失敗しました。アプリを再起動してください', true);
  }

  bindFooterActions();
  await loadQuestions();
}

function getSessionParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('session') || undefined;
}

async function ensureLiff() {
  if (window.liff) {
    await window.liff.init({ liffId: LIFF_ID || undefined });
    if (!window.liff.isLoggedIn()) {
      window.liff.login();
      return new Promise(() => {});
    }
    const profile = await window.liff.getProfile();
    liffProfile = {
      userId: profile.userId,
      displayName: profile.displayName || 'LINEユーザー',
    };
  } else {
    console.warn('window.liff not found, using debug profile');
  }
}

function bindFooterActions() {
  submitButton.addEventListener('click', onSubmit);
  retryButton.addEventListener('click', () => {
    hideToast();
    retryButton.classList.add('hidden');
    loadQuestions();
  });
  shareButton.addEventListener('click', () => {
    if (currentSessionId) {
      window.location.href = `${BASE_URL}/share/${currentSessionId}`;
    }
  });
}

async function loadQuestions() {
  questionsContainer.innerHTML = '';
  questionsContainer.setAttribute('aria-busy', 'true');
  const loading = document.createElement('div');
  loading.className = 'question-card';
  loading.innerHTML = '<p>読み込み中…</p>';
  questionsContainer.appendChild(loading);

  try {
    const response = await fetch('/api/diagnosis', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw await createFetchError(response);
    }
    fetchedQuestions = await response.json();
    totalQuestions = fetchedQuestions.length || DEFAULT_TOTAL;
    answers.clear();
    updateProgress();
    renderQuestions();
    questionsContainer.removeAttribute('aria-busy');
  } catch (error) {
    console.error('Failed to load questions', error);
    questionsContainer.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = '<p>通信に失敗しました。電波の良い場所で再試行してください。</p>';
    questionsContainer.appendChild(card);
    showToast(error.message || '読み込みに失敗しました', true, error.errorId);
    retryButton.classList.remove('hidden');
  }
}

function renderQuestions() {
  questionsContainer.innerHTML = '';
  fetchedQuestions.forEach((question, index) => {
    const card = document.createElement('section');
    card.className = 'question-card';
    card.setAttribute('data-question-id', question.question_id);

    const heading = document.createElement('h2');
    heading.textContent = `${index + 1}. ${question.text}`;
    card.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'choices';

    question.choices.forEach((choice) => {
      const choiceId = `${question.question_id}-${choice.key}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'choice';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = question.question_id;
      input.id = choiceId;
      input.value = choice.key;
      input.required = true;
      input.addEventListener('change', () => handleAnswerChange(question.question_id, choice.key));

      const label = document.createElement('label');
      label.setAttribute('for', choiceId);

      const title = document.createElement('span');
      title.className = 'choice-title';
      title.textContent = choice.label;

      label.appendChild(title);

      if (choice.desc) {
        const desc = document.createElement('span');
        desc.className = 'choice-desc';
        desc.textContent = choice.desc;
        label.appendChild(desc);
      }

      wrapper.appendChild(input);
      wrapper.appendChild(label);
      list.appendChild(wrapper);
    });

    card.appendChild(list);
    questionsContainer.appendChild(card);
  });
}

function handleAnswerChange(questionId, choiceKey) {
  answers.set(questionId, choiceKey);
  updateProgress();
}

function updateProgress() {
  const answeredCount = answers.size;
  const remaining = Math.max(totalQuestions - answeredCount, 0);
  answeredCountEl.textContent = answeredCount.toString();
  remainingCountEl.textContent = remaining.toString();
  const percent = totalQuestions === 0 ? 0 : (answeredCount / totalQuestions) * 100;
  progressFill.style.width = `${percent}%`;
  progressFill.parentElement?.setAttribute('aria-valuenow', answeredCount.toString());
  updateSubmitState();
  updateUnansweredAlert();
}

function updateSubmitState() {
  const canSubmit = answers.size === totalQuestions && totalQuestions > 0 && !isSubmitting;
  submitButton.disabled = !canSubmit;
}

function updateUnansweredAlert() {
  if (answers.size === totalQuestions && totalQuestions > 0) {
    unansweredAlert.style.display = 'none';
    return;
  }
  if (!fetchedQuestions.length) {
    unansweredAlert.style.display = 'none';
    return;
  }
  const missing = fetchedQuestions
    .map((q, idx) => ({ question: q, index: idx }))
    .filter(({ question }) => !answers.has(question.question_id))
    .map(({ index }) => `Q${index + 1}`);
  if (missing.length) {
    unansweredAlert.textContent = `未回答：${missing.join('、')}`;
    unansweredAlert.style.display = 'block';
  } else {
    unansweredAlert.style.display = 'none';
  }
}

async function onSubmit() {
  if (answers.size !== totalQuestions || isSubmitting) {
    updateUnansweredAlert();
    showToast('未回答の質問があります', true);
    return;
  }
  isSubmitting = true;
  updateSubmitState();
  submitContent.innerHTML = '<span class="spinner" aria-hidden="true"></span>';

  try {
    const payload = {
      userId: liffProfile.userId,
      sessionId: currentSessionId,
      answers: Array.from(answers.entries()).map(([question_id, choice_key]) => ({
        question_id,
        choice_key,
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
    currentSessionId = result.sessionId || currentSessionId;
    showResult(result);
    hideToast();
  } catch (error) {
    console.error('Submit failed', error);
    showToast(error.message || '送信に失敗しました', true, error.errorId);
    retryButton.classList.remove('hidden');
  } finally {
    isSubmitting = false;
    submitContent.textContent = '送信する';
    updateSubmitState();
  }
}

function showResult(result) {
  questionsContainer.classList.add('hidden');
  unansweredAlert.style.display = 'none';
  resultCard.style.display = 'block';
  submitButton.classList.add('hidden');
  retryButton.classList.add('hidden');
  shareButton.classList.remove('hidden');

  const cluster = result.cluster ? `タイプ：${result.cluster}` : '';
  const hero = result.heroSlug ? `推しキャラ：${result.heroSlug}` : '';

  resultUser.textContent = `${liffProfile.displayName} さん、おつかれさま。`;
  resultCluster.textContent = cluster;
  resultHero.textContent = hero;

  if (result.sessionId) {
    shareButton.disabled = false;
  } else {
    shareButton.disabled = true;
  }
}

function showToast(message, isError = false, errorId) {
  toastEl.textContent = errorId ? `${message} (ID: ${errorId})` : message;
  toastEl.classList.toggle('error', Boolean(isError));
  toastEl.style.display = 'block';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.style.display = 'none';
  }, 4000);
}

function hideToast() {
  toastEl.style.display = 'none';
  if (showToast._timer) {
    clearTimeout(showToast._timer);
  }
}

async function createFetchError(response) {
  let message = `通信に失敗しました (${response.status})`;
  let errorId;
  try {
    const data = await response.json();
    if (data && data.errorId) {
      errorId = data.errorId;
    }
    if (data && data.message) {
      message = data.message;
    }
  } catch (err) {
    // ignore JSON parse error
  }
  const error = new Error(message);
  if (errorId) {
    error.errorId = errorId;
  }
  return error;
}
