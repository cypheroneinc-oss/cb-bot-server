/* =========================
   C Lab｜個性チェック 完全修正版
   - 回答送信→ /api/answer（分析向けv2）
   - 結果カード & 共有
   ========================= */

const LIFF_ID = '2008019437-Jxwm33XM';
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;
const SHARE_IMAGE_URL = `${location.origin}/liff/assets/c_lab_share.png?v=1`;
const LANDING_URL = location.origin + '/liff/index.html';

// pronoun
function getPronounFromGender() {
  const g = document.querySelector('#gender')?.value || '';
  if (g === 'male') return 'ぼく';
  if (g === 'female') return 'わたし';
  return 'わたし';
}

// captions
const CAPTION_LINE = (title) =>
  `１０秒でわかる、あなたの「個性」。${getPronounFromGender()}は『${title}』だった！やってみて！`;

const CAPTION_OTHERS = (title) =>
  `１０秒でわかる、あなたの「個性」。${getPronounFromGender()}は『${title}』だった！みんなは？👇 #CLab #Cbyme #個性チェック`;

// ===== helpers =====
const $ = (sel, p = document) => p.querySelector(sel);
const $$ = (sel, p = document) => Array.from(p.querySelectorAll(sel));

function valRadio(name) {
  const v = $(`input[name="${name}"]:checked`);
  return v ? v.value : null;
}
function valsCheckedOrdered(name) {
  return $$(`input[name="${name}"]:checked`)
    .sort((a, b) => Number(a.dataset.order || 9e9) - Number(b.dataset.order || 9e9))
    .slice(0, 3)
    .map((b) => b.value);
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ===== Q3 sync =====
function syncMotivationHidden() {
  const hiddenContainer = $('#q3-hidden');
  if (!hiddenContainer) return;
  $$('input[name="q3"]', hiddenContainer).forEach((checkbox) => {
    checkbox.checked = false;
    delete checkbox.dataset.order;
  });
  ['mot1', 'mot2', 'mot3'].forEach((motId, index) => {
    const select = $(`#${motId}`);
    if (!select || !select.value) return;
    const checkbox = $(`input[name="q3"][value="${select.value}"]`, hiddenContainer);
    if (checkbox) {
      checkbox.checked = true;
      checkbox.dataset.order = (index + 1).toString();
    }
  });
}

// ===== LIFF init =====
async function initLIFF() {
  try {
    $('#status') && ($('#status').textContent = 'LIFF 初期化中…');
    if (typeof window.liff === 'undefined') throw new Error('LIFF SDK not available');
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isInClient()) {
      $('#status').textContent = 'LINEアプリで開くと共有できます';
      const btn = $('#share-line');
      if (btn) {
        btn.textContent = 'LINEで開き直す';
        btn.onclick = () => {
          location.href = LIFF_URL;
        };
      }
      if (!liff.isLoggedIn()) return liff.login();
    } else {
      if (!liff.isLoggedIn()) return liff.login();
    }
    const prof = await liff.getProfile();
    window.currentProfile = prof;
    $('#status').textContent = '読み込み完了';
    setupFormHandlers(prof);
  } catch (e) {
    console.error('LIFF initialization error:', e);
    const dummyProfile = {
      userId: 'liff-init-failed-' + Date.now(),
      displayName: 'LIFFエラーユーザー',
      pictureUrl: null,
    };
    window.dummyProfile = dummyProfile;
    setupFormHandlers(dummyProfile);
    $('#status').textContent = 'LIFF初期化失敗（ブラウザモード）';
  }
}

// ===== フォーム処理 =====
function setupFormHandlers(prof) {
  const form = $('#personalityForm');
  if (form) {
    form.addEventListener('submit', (e) => onSubmit(e, prof));
  }
  const runBtn = $('#run');
  if (runBtn) {
    runBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      } else {
        await onSubmit(e, prof || window.dummyProfile || { userId: 'anonymous', displayName: 'Anonymous' });
      }
    });
  }
}

async function onSubmit(e, prof) {
  e.preventDefault();
  syncMotivationHidden();
  if (!validateForm()) {
    console.warn('[validate] failed');
    return;
  }
  const answers = collectAnswers();
  const result = buildResult(answers);
  renderResultCard(result, prof, answers);
  await sendAnswer(prof, answers, result);
}

function validateForm() {
  const answers = collectAnswers();
  const requiredAB = ['q1', 'q2', 'q4', 'q5', 'q6', 'q7', 'q8'];
  for (const k of requiredAB) {
    if (!answers[k]) {
      alert('未回答の設問があります。');
      return false;
    }
  }
  if (!answers.q3.length) {
    alert('「やる気が出る理由」を1つ以上選んでください。');
    return false;
  }
  if (!answers.gender || !answers.age) {
    alert('性別と年齢を入力してください。');
    return false;
  }
  return true;
}

function collectAnswers() {
  const age = $('#age')?.value || '';
  const gender = $('#gender')?.value || '';
  const mbti = $('#mbti')?.value || '';
  return {
    q1: valRadio('q1'),
    q2: valRadio('q2'),
    q4: valRadio('q4'),
    q5: valRadio('q5'),
    q6: valRadio('q6'),
    q7: valRadio('q7'),
    q8: valRadio('q8'),
    q3: valsCheckedOrdered('q3'),
    age,
    gender,
    mbti,
  };
}

// ===== 診断ロジック =====
// …（省略、元のbuildResult・barnumCommentsそのまま）…

// ===== モーダル =====
function showResultModal() {
  const modal = $('#result-modal');
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    console.log('[modal] shown');
  }
}
function hideResultModal() {
  const modal = $('#result-modal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// ===== 結果カード描画 =====
function renderResultCard(result, prof, ans) {
  const wrap = $('#result-content');
  if (!wrap) return;
  const mot = (result.motivationTop3 || []).map((m, i) => `${i + 1}位：${m}`).join(' / ');
  const jobsList = (result.jobs || []).map((j) => `<li>${escapeHtml(j)}</li>`).join('');
  wrap.innerHTML = `
    <div class="card">
      <h3 class="ttl">【タイプ】 ${escapeHtml(result.typeTitle)}</h3>
      <p class="lead">${escapeHtml(result.tagline)}</p>
      <h4>【「あなた」の個性✨】</h4>
      <ul class="dots">${result.barnum.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
      <h4>【合う働き方⚡️】</h4>
      <p>${escapeHtml(result.style)}</p>
      <h4>【向いている職種の例💼】</h4>
      <ul class="dots">${jobsList}</ul>
      <h4>【あなたのやる気スイッチ💡】</h4>
      <p>${mot || '—'}</p>
      <h4>【アドバイス📝】</h4>
      <p>${escapeHtml(result.advice)}</p>
      <h4>👇今すぐ友達にシェア👇</h4>
      <div class="share">
        <button id="share-line" class="btn sub">LINEで送る</button>
        <button id="share-system" class="btn sub">ほかのアプリでシェア</button>
      </div>
    </div>`;
  // 結果ラッパを可視化
  const resultWrap = $('#result');
  if (resultWrap) resultWrap.style.display = 'block';
  showResultModal();
}

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.liff !== 'undefined') {
    initLIFF().catch((e) => {
      console.error('LIFF init failed:', e);
      const dummyProfile = { userId: 'liff-failed-' + Date.now(), displayName: 'LIFFユーザー', pictureUrl: null };
      window.dummyProfile = dummyProfile;
      setupFormHandlers(dummyProfile);
    });
  } else {
    $('#status').textContent = 'ブラウザモード（LIFF SDK未読込）';
    const dummyProfile = { userId: 'browser-user-' + Date.now(), displayName: 'ブラウザユーザー', pictureUrl: null };
    window.dummyProfile = dummyProfile;
    setupFormHandlers(dummyProfile);
  }
});
