// ===== 設定：LIFF ID を入れる（後で Vercel 環境変数から取得してもOK） =====
const LIFF_ID = 'ここにLIFF_IDを入れる';

const $ = (sel) => document.querySelector(sel);

async function init() {
  try {
    $('#status').textContent = 'LIFF 初期化…';
    await liff.init({ liffId: LIFF_ID });

    // LINEアプリ外で開いた場合はログイン誘導（開発時の直アクセス用）
    if (!liff.isInClient() && !liff.isLoggedIn()) {
      $('#status').innerHTML = 'ログインへリダイレクトします…';
      return liff.login(); // ここで画面遷移
    }

    const prof = await liff.getProfile();
    $('#displayName').textContent = prof.displayName;
    $('#inClient').textContent = String(liff.isInClient());
    $('#profile').style.display = 'block';
    $('#status').innerHTML = '<span class="ok">準備OK</span>';

    $('#submit').addEventListener('click', () => submitAnswers(prof.userId));
  } catch (e) {
    console.error(e);
    $('#status').innerHTML = `<span class="err">初期化エラー: ${e.message}</span>`;
  }
}

async function submitAnswers(lineUserId) {
  const answers = [
    $('#q1').value, $('#q2').value, $('#q3').value, $('#q4').value,
    $('#q5').value, $('#q6').value, $('#q7').value, $('#q8').value,
  ];
  $('#result').textContent = '送信中…';

  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_user_id: lineUserId, answers })
    });
    const data = await res.json();
    $('#result').textContent = JSON.stringify(data, null, 2);

    // トークへも返したい場合（chat_message.write が有効なら可）
    if (liff.isInClient() && liff.permission.queryScope().some(s => s === 'chat_message.write')) {
      try {
        await liff.sendMessages([{ type: 'text', text: `あなたのタイプ: ${data.result_type}\n${data.title}\n${data.body}` }]);
      } catch (_) { /* 失敗は無視 */ }
    }
  } catch (e) {
    $('#result').textContent = `送信失敗: ${e.message}`;
  }
}

init();
