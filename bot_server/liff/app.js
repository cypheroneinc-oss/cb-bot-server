// ===== 設定: ここに LIFF_ID を入れる（index.html の <meta name="liff-id"> でもOK） =====
const LIFF_ID_FALLBACK = "2008019437-Jxwm33XM";

// 小ユーティリティ
const $ = (sel) => document.querySelector(sel);
const getMeta = (name) =>
  document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") || "";

// 回答の読み取り（input[name="q1"~"q8"] の選択値を配列で返す）
function readAnswers() {
  const answers = [];
  for (let i = 1; i <= 8; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if (!checked) throw new Error(`Q${i} が未回答です`);
    answers.push(checked.value);
  }
  return answers;
}

// 画面メッセージ
function showStatus(msg, isError = false) {
  const el = $("#status");
  el.textContent = msg;
  el.style.color = isError ? "tomato" : "inherit";
}

// ============ エントリ ============
window.addEventListener("load", init);

async function init() {
  try {
    // 1) LIFF 初期化
    const liffId = getMeta("liff-id") || LIFF_ID_FALLBACK;
    if (!liffId || /ここにLIFF_IDを入れる/.test(liffId)) {
      showStatus("LIFF_ID が未設定です。index.html の <meta name=\"liff-id\"> か app.js を修正してください。", true);
      return;
    }
    showStatus("LIFF 初期化中…");
    await liff.init({ liffId });

    // 2) ログイン（外ブラウザ想定の保険）
    if (!liff.isInClient() && !liff.isLoggedIn()) {
      showStatus("ログインへリダイレクトします…");
      liff.login();
      return;
    }

    // 3) プロフィール取得＆表示
    const profile = await liff.getProfile();
    $("#displayName").textContent = profile.displayName || "";
    $("#userId").textContent = profile.userId || "";
    $("#inClient").textContent = String(liff.isInClient());
    $("#profile").style.display = "block";
    showStatus("準備OK");

    // 4) 送信ボタン
    $("#sendBtn")?.addEventListener("click", async () => {
      try {
        showStatus("送信中…");
        const answers = readAnswers();

        // サーバ（Vercel）へ POST
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            line_user_id: profile.userId,
            answers, // ["A","B",...]
          }),
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`/api/answer 失敗 (${res.status}) ${t}`);
        }

        const data = await res.json(); // { result_type, title, body, fit, cta? }
        // 画面に反映
        $("#resultType").textContent = data.result_type || "-";
        $("#resultTitle").textContent = data.title || "";
        $("#resultBody").textContent = data.body || "";
        $("#resultFit").textContent = data.fit || "";
        $("#result").style.display = "block";
        showStatus("送信完了");

        // 5) 可能ならトークへ結果を送信（chat_message.write を付けている場合）
        try {
          if (liff.isApiAvailable("shareTargetPicker")) {
            // シェアターゲットピッカー（任意）
            // await liff.shareTargetPicker([{ type: "text", text: `診断結果: ${data.title}\n${data.body}` }]);
          } else if (liff.isInClient()) {
            // トークへリプライ（LIFF内のみ）
            await liff.sendMessages([
              { type: "text", text: `診断結果: ${data.title}\n${data.body}` },
            ]);
          }
        } catch (e) {
          // 権限が無い・ユーザーが拒否などは無視
          console.warn("sendMessages/shareTargetPicker error:", e);
        }
      } catch (err) {
        console.error(err);
        showStatus(err.message || String(err), true);
        alert(err.message || String(err));
      }
    });

    // 6) 閉じるボタン（任意）
    $("#closeBtn")?.addEventListener("click", () => {
      if (liff.isInClient()) liff.closeWindow();
      else window.close();
    });
  } catch (e) {
    console.error(e);
    showStatus(e.message || String(e), true);
  }
}
