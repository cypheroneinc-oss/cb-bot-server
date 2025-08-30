// ===== LIFF 初期化 =====
const LIFF_ID = '2008019437-Jxwm33XM'; // ※後で空でもOK（webhook経由で起動なら未使用）
// すでに Vercel 環境変数から読み替える仕組みがあるなら上書き不要

const $ = (sel) => document.querySelector(sel);

async function init() {
  try {
    $("#status").textContent = "LIFF 初期化中…";
    await liff.init({ liffId: LIFF_ID });

    // ログイン誘導（ブラウザ直開き時の保険）
    if (!liff.isInClient() && !liff.isLoggedIn()) {
      $("#status").innerHTML = "ログインへリダイレクトします…";
      return liff.login();
    }

    // プロフィール表示（任意）
    const prof = await liff.getProfile().catch(() => null);
    if (prof) {
      $("#displayName").textContent = prof.displayName || "-";
      $("#userId").textContent = prof.userId || "-";
      $("#profile").style.display = "block";
    }
    $("#status").textContent = "";

    // ボタンで採点
    $("#submitBtn").addEventListener("click", onSubmit);
  } catch (e) {
    $("#status").textContent = `LIFF初期化エラー: ${e?.message || e}`;
  }
}

function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}
function getMotives() {
  return Array.from(document.querySelectorAll('input[name="motive"]:checked')).map(el => el.value);
}

// ---- ロジック ----
//
// 軸1：行動(=q1 A) or 計画(=q1 B)
// 軸2：直感(=q2 A) or 根拠(=q2 B)
// 4タイプに割り当て
const TYPE_MAP = {
  AA: { // 行動 × 直感
    type: "チャレンジャー（行動×直感）",
    work: "新しい挑戦・スピード重視の環境。裁量があって動ける現場が◎",
    jobs: ["PdM/事業開発","スタートアップ総合職","企画営業","マーケ（グロース）"],
    advice: "走りながら考える長所は武器。要所の根拠づけ/共有を意識すると周囲の信頼が跳ね上がる。"
  },
  AB: { // 行動 × 根拠
    type: "オペレーター（行動×根拠）",
    work: "目標とKPIが明確で、改善を高速に回す環境。役割と期待が定義されていると力を発揮。",
    jobs: ["内勤営業/CS","広告運用","データドリブンなマーケ","業務改善/オペ設計"],
    advice: "事前段取りと実行の両輪が強み。過度な完璧主義に注意し、80点で回し学習を。"
  },
  BA: { // 計画 × 直感
    type: "クリエイター（計画×直感）",
    work: "ある程度の自由度と探究余地。0→1の着想を形にしつつ、丁寧に磨ける場。",
    jobs: ["UX/UIデザイン","編集/コンテンツ制作","リサーチ/インサイト","プロトタイピング"],
    advice: "発想を企画書・モックで見せると周囲が動く。締切とマイルストーンの見える化を。"
  },
  BB: { // 計画 × 根拠
    type: "プランナー（計画×根拠）",
    work: "全体像を描き、段階的に積む環境。品質・安全・正確性が重要な領域との相性良。",
    jobs: ["PM/PMO","経営企画","バックオフィス（法務/財務）","品質/リスク管理"],
    advice: "精密さが強み。過度な慎重さで機会を逃さないよう、実験枠を持つとバランス良。"
  }
};

function decideType(q1, q2) {
  const k1 = q1 === 'A' ? 'A' : 'B';
  const k2 = q2 === 'A' ? 'A' : 'B';
  return TYPE_MAP[k1 + k2];
}

function buildWorkstyleHints({ q4, q5, q6, q7, q8, motives }) {
  const pills = [];

  // 苦手
  if (q4 === 'A') pills.push("細かい指示より裁量がある方が捗る");
  if (q4 === 'B') pills.push("完全放任より伴走や定期合意があると安心");

  // 感情
  if (q5 === 'A') pills.push("オープンに感情共有できる文化が◎");
  if (q5 === 'B') pills.push("落ち着いて集中できる環境が◎");

  // チーム
  if (q6 === 'A') pills.push("率直に意見を交わせるチームが合う");
  if (q6 === 'B') pills.push("和やかで空気を大切にするチームが合う");

  // 役割
  if (q7 === 'A') pills.push("リード/推進の役割が向く");
  if (q7 === 'B') pills.push("支援/潤滑油の役割が向く");

  // 働き方
  if (q8 === 'A') pills.push("スペシャリスト志向が合う");
  if (q8 === 'B') pills.push("ゼネラリスト志向が合う");

  // モチベ
  if (motives && motives.length) {
    pills.push("モチベ源: " + motives.slice(0, 4).join("・"));
  }

  return pills.map(p => `<span class="pill">${p}</span>`).join(" ");
}

function suggestJobs(base, q7, q8) {
  // ベースタイプ + 志向で微調整
  let list = [...base.jobs];
  if (q7 === 'A') list.unshift("プロジェクト推進/チームリード");
  if (q7 === 'B') list.unshift("アシスタント/コーディネーター");
  if (q8 === 'A') list.push("専門職（スペシャリスト系）");
  if (q8 === 'B') list.push("横断/企画系（ゼネラリスト）");
  return Array.from(new Set(list)).slice(0, 6).join("、");
}

async function onSubmit() {
  // 入力取得
  const q1 = getRadio('q1');
  const q2 = getRadio('q2');
  const motives = getMotives();
  const q4 = getRadio('q4');
  const q5 = getRadio('q5');
  const q6 = getRadio('q6');
  const q7 = getRadio('q7');
  const q8 = getRadio('q8');

  // 必須チェック
  if (!q1 || !q2 || !q4 || !q5 || !q6 || !q7 || !q8) {
    alert('未回答の設問があります');
    return;
  }

  // タイプ決定
  const base = decideType(q1, q2);
  const workHints = buildWorkstyleHints({ q4, q5, q6, q7, q8, motives });
  const jobs = suggestJobs(base, q7, q8);

  // 表示
  $("#typeText").textContent = base.type;
  $("#fitWorkstyle").innerHTML = workHints || "-";
  $("#fitJobs").textContent = jobs;
  $("#advice").textContent = base.advice;

  $("#resultBox").style.display = "block";

  // （任意）サーバに保存したい場合はここでPOST
  // await fetch('/api/answer', { method:'POST', headers:{'content-type':'application/json'},
  //   body: JSON.stringify({ q1,q2,q4,q5,q6,q7,q8, motives }) });
}

init();
