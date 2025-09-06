// =========================
// C Lab｜個性チェック
// =========================

const LIFF_ID = '2008019437-Jxwm33XM';
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;
const SHARE_IMAGE_URL = `${location.origin}/liff/assets/c_lab_share.png?v=1`;
const LANDING_URL = location.origin + '/liff/index.html';

const $  = (sel, p = document) => p.querySelector(sel);
const $$ = (sel, p = document) => Array.from(p.querySelectorAll(sel));

function valRadio(name) {
  const v = $(`input[name="${name}"]:checked`);
  return v ? v.value : null;
}
function valsCheckedOrdered(name) {
  return $$(`input[name="${name}"]:checked`)
    .sort((a, b) => Number(a.dataset.order || 9e9) - Number(b.dataset.order || 9e9))
    .slice(0, 3)
    .map(b => b.value);
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
  );
}

// ---------------- Q3 hidden 同期 ----------------
function syncMotivationHidden() {
  const hiddenContainer = $('#q3-hidden');
  if (!hiddenContainer) return;

  $$('input[name="q3"]', hiddenContainer).forEach(cb => {
    cb.checked = false;
    delete cb.dataset.order;
  });

  ['mot1', 'mot2', 'mot3'].forEach((motId, index) => {
    const select = $(`#${motId}`);
    if (!select || !select.value) return;
    const cb = $(`input[name="q3"][value="${select.value}"]`, hiddenContainer);
    if (cb) {
      cb.checked = true;
      cb.dataset.order = (index + 1).toString();
    }
  });
}

// ---------------- LIFF init ----------------
async function initLIFF() {
  try {
    if (typeof window.liff === 'undefined') throw new Error('LIFF SDK not available');
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) liff.login();
    const prof = await liff.getProfile();
    setupFormHandlers(prof);
  } catch (e) {
    console.warn('LIFF初期化失敗 -> ブラウザモード', e);
    const dummyProfile = { userId: 'browser-' + Date.now(), displayName: 'BrowserUser' };
    setupFormHandlers(dummyProfile);
  }
}

// ---------------- フォーム送信 ----------------
function setupFormHandlers(prof) {
  const form = $('#personalityForm');
  form?.addEventListener('submit', (e) => onSubmit(e, prof));
  $('#run')?.addEventListener('click', (e) => {
    e.preventDefault();
    form?.requestSubmit();
  });
}

async function onSubmit(e, prof) {
  e.preventDefault();
  syncMotivationHidden();
  if (!validateForm()) return;

  const answers = collectAnswers();
  const result = buildResult(answers);
  renderResultCard(result, prof, answers);
  await sendAnswer(prof, answers, result);
}

function validateForm() {
  const a = collectAnswers();
  const required = ['q1','q2','q4','q5','q6','q7','q8'];
  for (const k of required) if (!a[k]) return alert('未回答あり'), false;
  if (!a.q3.length) return alert('モチベーションを選んでください'), false;
  if (!a.gender || !a.age) return alert('性別と年齢を入力してください'), false;
  return true;
}

function collectAnswers() {
  return {
    q1: valRadio('q1'), q2: valRadio('q2'),
    q4: valRadio('q4'), q5: valRadio('q5'),
    q6: valRadio('q6'), q7: valRadio('q7'), q8: valRadio('q8'),
    q3: valsCheckedOrdered('q3'),
    age: $('#age')?.value || '', gender: $('#gender')?.value || '', mbti: $('#mbti')?.value || ''
  };
}

// ---------------- 診断ロジック ----------------
function buildResult(ans) {
  let sC=0,sP=0;
  if(ans.q1==='A')sC++;else if(ans.q1==='B')sP++;
  if(ans.q2==='A')sC++;else if(ans.q2==='B')sP++;
  if(ans.q5==='A')sC++;else sP++;
  if(ans.q6==='A')sC++;else sP++;
  if(ans.q7==='A')sC++;else sP++;
  if(ans.q8==='B')sC++;else sP++;
  let typeKey='balance';
  if(sC-sP>=2)typeKey='challenge';
  else if(sP-sC>=2)typeKey='plan';
  return { typeKey, typeTitle:typeKey };
}

function renderResultCard(result) {
  $('#result').innerHTML = `<div class="card"><h3>${result.typeTitle}</h3></div>`;
  $('#result').style.display='block';
}

// ---------------- サーバ送信 ----------------
async function sendAnswer(profile, answers, result) {
  try {
    const res = await fetch('/api/answer', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ profile, answers, result })
    });
    console.log('送信結果', await res.json());
  } catch(e){ console.error('送信失敗', e); }
}

// ---------------- 起動 ----------------
document.addEventListener('DOMContentLoaded',()=>{
  ['mot1','mot2','mot3'].forEach(id=>$('#'+id)?.addEventListener('change',syncMotivationHidden));
  syncMotivationHidden();
  if(typeof window.liff!=='undefined')initLIFF();
  else setupFormHandlers({userId:'dummy'});
});
