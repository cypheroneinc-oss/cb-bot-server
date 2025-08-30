<!-- これは JS ファイルです。拡張子は .js で保存 -->
<script>
/**
 * 必要スクリプトの読み込み順（index.html 内）：
 *  1) https://static.line-scdn.net/liff/edge/2/sdk.js
 *  2) /liff/questions.js
 *  3) /liff/results.js
 *  4) /liff/app.js（このファイル）
 */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Vercel の環境変数から埋め込むなら、ビルド時に置換 or data-* で受け取る
const LIFF_ID = window.LIFF_ID || ""; // index.htmlで window.LIFF_ID にセットしてもOK
const API_BASE = location.origin;     // 同一ドメインの /api/answer にPOST

async function initLiff() {
  $("#status").textContent = "LIFFの準備中…";
  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) {
    $("#status").textContent = "ログインします…";
    return liff.login();
  }
  const prof = await liff.getProfile();
  $("#status").innerHTML = `こんにちは、<b>${prof.displayName}</b> さん！`;
  $("#userId").textContent = prof.userId || "";

  renderForm();
}

function renderForm() {
  const wrap = $("#form");
  wrap.innerHTML = "";

  window.QUESTIONS.forEach((q) => {
    const section = document.createElement("section");
    section.className = "q-section";

    section.innerHTML = `
      <h3 class="q-title">${q.title}</h3>
      <p class="q-question">Q: ${q.question}</p>
      <div class="q-options" data-q="${q.id}" data-type="${q.type}"></div>
    `;
    wrap.appendChild(section);

    const box = section.querySelector(".q-options");

    if (q.type === "AB") {
      q.options.forEach((op) => {
        const id = `${q.id}_${op.value}`;
        box.insertAdjacentHTML(
          "beforeend",
          `
          <label class="opt">
            <input type="radio" name="${q.id}" value="${op.value}" />
            <span>${op.label}</span>
          </label>
          `
        );
      });
    } else if (q.type === "MULTI") {
      q.options.forEach((op) => {
        const id = `${q.id}_${op.value}`;
        box.insertAdjacentHTML(
          "beforeend",
          `
          <label class="opt">
            <input type="checkbox" name="${q.id}" value="${op.value}" />
            <span>${op.label}</span>
          </label>
          `
        );
      });
    }
  });

  $("#submit").disabled = false;
  $("#submit").addEventListener("click", onSubmit);
}

function collectAnswers() {
  const getAB = (qid) => {
    const el = $(`input[name="${qid}"]:checked`);
    return el ? el.value : null;
    };
  const getMulti = (qid) =>
    $$(`input[name="${qid}"]:checked`).map((x) => x.value);

  return {
    q1: getAB("q1"),
    q2: getAB("q2"),
    q3: getMulti("q3"),
    q4: getAB("q4"),
    q5: getAB("q5"),
    q6: getAB("q6"),
    q7: getAB("q7"),
    q8: getAB("q8"),
  };
}

function validate(answers) {
  const miss = [];
  ["q1","q2","q4","q5","q6","q7","q8"].forEach(k => { if(!answers[k]) miss.push(k); });
  if ((answers.q3||[]).length === 0) miss.push("q3");
  return miss;
}

async function onSubmit() {
  $("#submit").disabled = true;
  const answers = collectAnswers();
  const miss = validate(answers);
  if (miss.length) {
    alert("未回答があります: " + miss.join(", "));
    $("#submit").disabled = false;
    return;
  }

  // 診断を作る（results.js）
  const result = window.buildDiagnosis(answers);

  // 画面に表示
  renderResult(result);

  // 保存（Vercelの /api/answer へ。サーバ側で Supabase 保存＆集計）
  try {
    const profile = await liff.getProfile();
    await fetch(`${API_BASE}/api/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: profile.userId,
        answers,
        result,
        source: "liff-v2",
      })
    });
  } catch (e) {
    console.warn("保存に失敗しました（後で再送されることがあります）", e);
  } finally {
    $("#submit").disabled = false;
  }
}

function renderChipList(arr) {
  if (!arr || !arr.length) return "<span>-</span>";
  return `<ul class="chips">${arr.map(t => `<li>${t}</li>`).join("")}</ul>`;
}

function renderResult(r) {
  $("#result").innerHTML = `
    <div class="card">
      <h3>【タイプ】${r.typeTitle}</h3>
      <p>${r.typeDesc}</p>

      <h4>【合う働き方】</h4>
      <ul>
        <li>進め方：${r.style}</li>
        <li>決め方：${r.decision}</li>
        <li>チーム：${r.team}</li>
        <li>役割：${r.role}</li>
        <li>理想：${r.ideal}</li>
      </ul>

      <h4>【やる気スイッチ】</h4>
      ${renderChipList(r.motivation)}

      <h4>【向いている職種の例】</h4>
      ${renderChipList(r.goodJobs)}

      <h4>【アドバイス】</h4>
      ${renderChipList(r.advice)}
    </div>
  `;
}

// 起動
document.addEventListener("DOMContentLoaded", initLiff);
</script>
