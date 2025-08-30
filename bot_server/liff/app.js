// app.js
// --- LIFF & 診断ロジック制御 ---

// LIFF初期化
window.onload = async function () {
  await liff.init({ liffId: "YOUR_LIFF_ID" }); // 環境変数に置き換えることも可
  if (!liff.isLoggedIn()) {
    liff.login();
  }
};

// 質問データ
const questions = [
  {
    q: "何かに取りかかるとき、近いのは？",
    a: ["とりあえず始めて、やりながら直す", "まず全体を整理してから始める"]
  },
  {
    q: "悩んだとき、より大事にするのは？",
    a: ["なんとなくの直感やフィーリング", "理由やデータなどの根拠"]
  },
  {
    q: "『よし、がんばろう！』と思えるのは？（複数OK）",
    a: [
      "成果を出したとき（達成感）", "認められたり褒められたとき（承認）",
      "誰かの役に立ったとき（貢献）", "安心できる環境があるとき（安心）",
      "新しいことを知れたとき（探究）", "自分のやり方で自由にできるとき（自由）",
      "仲間と一緒に動けるとき（仲間）", "成長している実感があるとき（成長）"
    ]
  },
  {
    q: "どちらの方がイヤ？",
    a: ["ずっと細かく指示される", "ほったらかしで丸投げされる"]
  },
  {
    q: "気持ちが盛り上がったとき、近いのは？",
    a: ["顔や言葉にすぐ出る", "外には出ないけど心の中で燃える"]
  },
  {
    q: "一緒にいてラクなのは？",
    a: ["何でもハッキリ言えるチーム", "空気を大事にして和やかなチーム"]
  },
  {
    q: "自然に多いのは？",
    a: ["みんなを引っ張るリーダー役", "サポートして支える役"]
  },
  {
    q: "理想に近いのは？",
    a: ["一つのことをじっくり極める", "いろんなことに同時にチャレンジする"]
  }
];

// 回答を格納
let answers = [];

// 質問を表示する関数
function renderQuestion(index) {
  if (index >= questions.length) {
    showResult();
    return;
  }
  const q = questions[index];
  document.getElementById("question").innerText = q.q;
  const optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = "";
  q.a.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.innerText = opt;
    btn.onclick = () => {
      answers.push(opt);
      renderQuestion(index + 1);
    };
    optionsDiv.appendChild(btn);
  });
}

// 結果計算（シンプル例）
function showResult() {
  let resultText = "";

  if (answers.includes("とりあえず始めて、やりながら直す")) {
    resultText += "👉 行動派タイプ！スタートアップや営業職に向いているよ。\n";
  }
  if (answers.includes("まず全体を整理してから始める")) {
    resultText += "👉 計画派タイプ！企画・管理系や研究職に向いているよ。\n";
  }
  if (answers.includes("仲間と一緒に動けるとき（仲間）")) {
    resultText += "👉 チームで動く仕事が得意！（イベント運営・教育など）\n";
  }
  if (answers.includes("自分のやり方で自由にできるとき（自由）")) {
    resultText += "👉 クリエイティブやフリーランス系が合ってるかも！\n";
  }

  // 診断結果を表示
  document.getElementById("question").innerText = "診断結果";
  document.getElementById("options").innerHTML =
    `<pre>${resultText}</pre>`;

  // サーバに送信（回答ログ保存）
  sendAnswers();
}

// サーバにPOST
async function sendAnswers() {
  try {
    const profile = await liff.getProfile();
    await fetch("/api/saveAnswers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: profile.userId,
        name: profile.displayName,
        answers: answers,
        timestamp: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error("送信エラー:", e);
  }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  renderQuestion(0);
});
