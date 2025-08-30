// ===== 設定：あなたの LIFF ID を入れる（サーバ側の環境変数とは別口） =====
const LIFF_ID = '2008019437-Jxwm33XM';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const picked = []; // 動機の選択順を記録（最大3件）

function toggleSubmit() {
  const filled =
    ['q1','q2','q4','q5','q6','q7','q8'].every(n => $(`input[name="${n}"]:checked`)) &&
    picked.length >= 1;
  $('#submit').disabled = !filled;
}

function setupMotivationPicker() {
  $$('#moti input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const v = cb.value;
      const i = picked.indexOf(v);
      if (cb.checked) {
        if (picked.length >= 3) { cb.checked = false; return; }
        if (i === -1) picked.push(v);
      } else {
        if (i >= 0) picked.splice(i,1);
      }
      $('#moti-picked').textContent = String(picked.length);
      toggleSubmit();
    });
  });
}

async function init() {
  try {
    $('#status').textContent = 'LIFF 初期化…';
    await liff.init({ liffId: LIFF_ID });

    // アプリ外（ブラウザ）で開かれたらログインへ
    if (!liff.isInClient() && !liff.isLoggedIn()) {
      $('#status').textContent = 'ログインへリダイレクト…';
      return liff.login();
    }

    const prof = await liff.getProfile();
    $('#userId').textContent = prof.userId || '';
    $('#status').innerHTML = '<span class="ok">準備OK</span>';

    setupMotivationPicker();
    $$('input[type="radio"]').forEach(r => r.addEventListener('change', toggleSubmit));
    toggleSubmit();

    // 送信
    $('#form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#submit').disabled = true;

      const get = (n) => ($(`input[name="${n}"]:checked`)||{}).value || null;

      const answers = {
        q1: get('q1'),
        q2: get('q2'),
        q3: picked.slice(0,3),        // 選択順＝優先順位
        q4: get('q4'),
        q5: get('q5'),
        q6: get('q6'),
        q7: get('q7'),
        q8: get('q8'),
      };

      const payload = {
        line_user_id: prof.userId,
        answers
      };

      try {
        const res = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        const moti = (data.motivations||[]).map(s=>`#${s}`).join(' ');
        const prefs = [
          `苦手: ${data.env_prefer}`,
          `感情: ${data.emotion}`,
          `チーム: ${data.team}`,
          `役割: ${data.role}`,
          `働き方: ${data.work_style}`
        ].join('\n');

        $('#out').style.display = 'block';
        $('#out').innerHTML =
`【タイプ】${data.title}
${data.body}

【あなたのモチベーション上位】
${moti}

【相性のいい働き方】
${data.fit}

—— 補足 —
${prefs}
`;
      } catch (err) {
        $('#out').style.display = 'block';
        $('#out').innerHTML = `<span class="err">エラー: ${err?.message || err}</span>`;
      } finally {
        $('#submit').disabled = false;
      }
    });

  } catch (e) {
    $('#status').innerHTML = `<span class="err">初期化失敗: ${e?.message||e}</span>`;
  }
}

init();
