// bot_server/liff/app.js
// ===== 設定：LIFF ID（Vercel 環境変数を使う場合は埋め込まず直接 liff.init({ liffId })でOK） =====
const LIFF_ID = '2008019437-Jxwm33XM'; // 既に環境変数 → 埋め込み不要ならそのままでも動きます

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

async function init() {
  try {
    $('#status').textContent = 'LIFF 初期化中…';
    await liff.init({ liffId: LIFF_ID });

    if (!liff.isInClient() && !liff.isLoggedIn()) {
      $('#status').textContent = 'ログインにリダイレクトします…';
      return liff.login();
    }

    const prof = await liff.getProfile();
    $('#displayName').textContent = prof.displayName;
    $('#userId').textContent = String(prof.userId || '');
    $('#profile').style.display = 'block';
    $('#status').innerHTML = '<span class="ok">準備OK</span>';

    bindSubmit(prof.userId);
  } catch (e) {
    $('#status').textContent = e.message || String(e);
  }
}

function readRadio(name) {
  const el = $(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}
function readChecks(name) {
  return $$(`input[name="${name}"]:checked`).map(el => el.value);
}

function bindSubmit(userId) {
  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('#submitBtn').disabled = true;
    $('#submitBtn').textContent = '送信中…';

    const answers = {
      q1: readRadio('q1'),
      q2: readRadio('q2'),
      q3: readChecks('q3'),   // 複数可
      q4: readRadio('q4'),
      q5: readRadio('q5'),
      q6: readRadio('q6'),
      q7: readRadio('q7'),
      q8: readRadio('q8'),
    };

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ line_user_id: userId, answers })
      });
      const data = await res.json();

      // 期待する返却: { result_type, title, body, fit, jobs?, tips? }
      $('#typeTitle').textContent = data.title || data.result_type || '-';
      $('#typeBody').innerText = data.body || '';
      $('#fit').innerText = data.fit || '';

      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      $('#jobs').innerHTML = jobs.map(j => `<li>${j}</li>`).join('');

      const tips = Array.isArray(data.tips) ? data.tips : [];
      $('#tips').innerHTML = tips.map(t => `<li>${t}</li>`).join('');

      $('#result').style.display = 'block';
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (e) {
      alert('送信に失敗しました：' + (e.message || e));
    } finally {
      $('#submitBtn').disabled = false;
      $('#submitBtn').textContent = '結果を取得';
    }
  });
}

init();
