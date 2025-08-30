// ===== 設定: LIFF ID（Vercelの環境変数から差し込むなら script 等で渡してOK）=====
const LIFF_ID = '2008019437-Jxwm33XM'; // 例: window.__LIFF_ID || 'xxxx'

// UIヘルパ
const $ = (sel) => document.querySelector(sel);

// 日本語表示だが、value はスコアロジックが期待するトークンに統一
//（scorer.js が参照する語彙: Intuition / Logic / High / Low / Care / Speed / 成果 / 仲間 / 安心 / 明るい / 自由 など）
const QUESTIONS = {
  q1: [
    { label: '直感型', value: 'Intuition' },
    { label: '論理型', value: 'Logic' },
  ],
  q2: [
    { label: '高い（攻める）', value: 'High' },
    { label: '低い（堅実）', value: 'Low' },
  ],
  q3: [
    { label: '思いやり重視', value: 'Care' },
    { label: '成果重視', value: '成果' }, // scorer.js が '成果' を見にいく想定
  ],
  q4: [
    { label: 'スピード最優先', value: 'Speed' },
    { label: '周囲への配慮', value: 'Care' },
    { label: '結果へのこだわり', value: '成果' },
  ],
  q5: [
    { label: '直感寄り', value: 'Intuition' },
    { label: '論理寄り', value: 'Logic' },
  ],
  q6: [
    { label: '仲間・一体感', value: '仲間' },
    { label: '安心・安定', value: '安心' },
  ],
  q7: [
    { label: '明るい・ポジティブ', value: '明るい' },
    { label: '落ち着き・誠実', value: 'まっとう' },
  ],
  q8: [
    { label: '自由・裁量', value: '自由' },
    { label: 'サポート・調和', value: 'Care' },
  ],
};

// セレクトを動的に描画
function renderSelect(name) {
  const sel = document.getElementById(name);
  sel.innerHTML = '';
  (QUESTIONS[name] || []).forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sel.appendChild(o);
  });
}

// LIFF 初期化
async function init() {
  try {
    $('#status').textContent = 'LIFF 初期化…';
    await liff.init({ liffId: LIFF_ID });

    // ブラウザ直開き時は LINE ログインへ誘導（開発中の利便用）
    if (!liff.isInClient() && !liff.isLoggedIn()) {
      $('#status').innerHTML = 'ログインへリダイレクトします…';
      return liff.login();
    }

    // 質問項目の描画
    ['q1','q2','q3','q4','q5','q6','q7','q8'].forEach(renderSelect);

    // プロフィール
    const prof = await liff.getProfile().catch(() => null);
    const userId = prof?.userId || '';
    const name = prof?.displayName || '';

    // 要素が無い場合でも落ちないようにガード
    const userIdEl = $('#userId');
    if (userIdEl) userIdEl.textContent = userId;
    const nameEl = $('#displayName');
    if (nameEl) nameEl.textContent = name;

    $('#status').innerHTML = '<span class="ok">LIFF 準備OK</span>';

    // 送信
    $('#form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#submitBtn').disabled = true;

      const answers = {
        q1: $('#q1').value, q2: $('#q2').value, q3: $('#q3').value, q4: $('#q4').value,
        q5: $('#q5').value, q6: $('#q6').value, q7: $('#q7').value, q8: $('#q8').value,
      };

      try {
        const res = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line_user_id: userId, answers }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'API error');

        // 画面表示
        const box = $('#result');
        box.style.display = 'block';
        box.innerHTML = `
          <div class="card">
            <div><b>診断タイプ:</b> ${json.result_type}</div>
            <div style="margin-top:8px"><b>${json.title}</b></div>
            <div style="margin-top:4px">${json.body}</div>
            <div style="margin-top:8px;font-size:12px;color:#666">
              ※ この結果はC by meのスコアリングロジックで算出されています
            </div>
          </div>
        `;

        // LINEミニアプリ内なら自動で閉じる等も可
        // if (liff.isInClient()) setTimeout(() => liff.closeWindow(), 1200);
      } catch (err) {
        $('#status').innerHTML = `<span class="warn">${err.message}</span>`;
      } finally {
        $('#submitBtn').disabled = false;
      }
    });
  } catch (e) {
    $('#status').innerHTML = `<span class="warn">初期化に失敗: ${e.message}</span>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
