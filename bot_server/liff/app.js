/* =========================
   C Lab｜かんたん診断（LIFF）
   - index.html の質問テキストに完全対応
   - 回答送信→ /api/answer
   - 結果カード
   - 共有（LINE / Instagram / X / Threads）
   - 「当たってるかも？」は私生活寄りのバーナム文
   ========================= */

// ★ あなたの LIFF ID を入れてください（LINE Developers の LIFF ID）
const LIFF_ID = '2008019437-Jxwm33XM';

// 固定シェア画像（/liff/assets/c_lab_share.png を公開配信）
const SHARE_IMAGE_URL = `${location.origin}/liff/assets/c_lab_share.png?v=1`;

// 共有時に一緒に載せる着地点（友だち追加/診断トップなど）
const LANDING_URL = location.origin + '/liff/index.html';

// ▼追加：性別セレクト(#gender)から一人称を決める
function getPronounFromGender() {
  // #gender の value: male / female / other
  const g = document.querySelector('#gender')?.value || '';
  if (g === 'male')   return 'ぼく';
  if (g === 'female') return 'わたし';
  return 'わたし'; // その他/未選択のフォールバック
}

// ▼差し替え：タイプ名と一人称を含む共有文面
const CAPTION = (title) =>
  `１０秒でわかる、あなたの「個性」。${getPronounFromGender()}は${title}だった！みんなは？👇 #CLab #Cbyme #個性チェック`;

// ===== ヘルパ =====
const $  = (sel, p = document) => p.querySelector(sel);
const $$ = (sel, p = document) => Array.from(p.querySelectorAll(sel));

function valRadio(name) {
  const v = $(`input[name="${name}"]:checked`);
  return v ? v.value : null;
}
function valsCheckedOrdered(name) {
  // hidden の checkbox(name="q3") を data-order 昇順で取得（最大3）
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
const genderJa = (g) => g === 'male' ? '男性' : g === 'female' ? '女性' : g === 'other' ? 'その他' : '—';

// ===== LIFF init =====
async function initLIFF() {
  $('#status') && ($('#status').textContent = 'LIFF 初期化中…');
  await liff.init({ liffId: LIFF_ID });

  // LINE 外ブラウザならログイン（開発直叩き用）
  if (!liff.isInClient() && !liff.isLoggedIn()) {
    $('#status').textContent = 'ログインへリダイレクトします…';
    return liff.login();
  }

  const prof = await liff.getProfile();
  $('#status').textContent = '読み込み完了';

  // 実行ボタン
  $('#run')?.addEventListener('click', async () => {
    const answers = collectAnswers();

    // 必須チェック
    const requiredAB = ['q1','q2','q4','q5','q6','q7','q8'];
    for (const k of requiredAB) {
      if (!answers[k]) { alert('未回答の設問があります。'); return; }
    }
    if (!answers.q3.length) {
      alert('「やる気が出る理由」を1つ以上選んでください。');
      return;
    }
    if (!answers.gender || !answers.age) {
      alert('性別と年齢を入力してください。');
      return;
    }

    const result = buildResult(answers);
    renderResultCard(result, prof, answers);
    await sendAnswer(prof, answers, result);
  });
}

// ===== 回答収集 =====
function collectAnswers() {
  // プロフィール
  const age    = $('#age')?.value || '';
  const gender = $('#gender')?.value || '';
  const mbti   = $('#mbti')?.value || '';

  return {
    // A/B 設問（radio）
    q1: valRadio('q1'),
    q2: valRadio('q2'),
    q4: valRadio('q4'),
    q5: valRadio('q5'),
    q6: valRadio('q6'),
    q7: valRadio('q7'),
    q8: valRadio('q8'),
    // 多選（最大3／順位あり）
    q3: valsCheckedOrdered('q3'),
    age, gender, mbti
  };
}

// ===== 診断ロジック =====
function buildResult(ans) {
  // スコア：チャレンジ vs 計画
  let sChallenge = 0, sPlan = 0;
  if (ans.q1 === 'A') sChallenge++; else if (ans.q1 === 'B') sPlan++;
  if (ans.q2 === 'A') sChallenge++; else if (ans.q2 === 'B') sPlan++;
  if (ans.q5 === 'A') sChallenge++; else sPlan++;
  if (ans.q6 === 'A') sChallenge++; else sPlan++;
  if (ans.q7 === 'A') sChallenge++; else sPlan++;
  if (ans.q8 === 'B') sChallenge++; else sPlan++;

  let typeKey = 'balance';
  if (sChallenge - sPlan >= 2) typeKey = 'challenge';
  else if (sPlan - sChallenge >= 2) typeKey = 'plan';

  const TYPES = {
    challenge: {
      title: 'チャレンジ先行タイプ💪',
      tagline: '思い立ったらすぐ動ける！まずやってみて、直しながら前へ進むのが得意。',
      style: 'スピード感のある環境／小さく試して改善していく働き方',
      jobs: [
        '企画・プロデュース（新しい案を形にする）',
        'セールス／提案（訪問・オンライン）',
        '広報・SNS運用（発信して人を集める）',
        'イベント運営・プロモーション',
        '新サービスづくり（試作・PoC）',
        '取材・インタビュー（現場で動いて集める）'
      ],
      advice: '走り出しは強み。あとで「なぜそうしたか」を一言メモに残すと説得力UP。小さなゴールを細かく刻むと達成感が積み上がる。'
    },
    plan: {
      title: '計画ていねいタイプ🧭',
      tagline: '全体像を整理してから進むほうが力を発揮！再現性や安定感が武器。',
      style: '見通しが立つ環境／手順やルールを整えて進める働き方',
      jobs: [
        '事務・総務（書類／備品／スケジュール管理）',
        '経理アシスタント（伝票チェック・支払処理）',
        'データ入力・データ整備',
        '品質管理・検査（チェックリストで確認）',
        '資料作成（Excel・PowerPoint）',
        '在庫／発注管理（コツコツ把握してズレを防ぐ）'
      ],
      advice: '最初に段取りを書き出すと安心感とスピードが両立。区切りごとに振り返りをルーチン化すると成果が伸びる。'
    },
    balance: {
      title: 'バランス型🧩',
      tagline: '状況を見て攻守を切り替えられるオールラウンダー！',
      style: '変化に強い環境／状況で役割を調整する働き方',
      jobs: [
        'プロジェクト進行管理（ディレクター／アシスタント）',
        'カスタマーサポート／ヘルプデスク',
        '人事・採用アシスタント（面談調整・連絡）',
        'コミュニティ運営・ファン対応',
        '学習サポート／塾TA・メンター',
        'シフト調整・現場リーダー（みんなを支える）'
      ],
      advice: '優先度の基準を1つ決めておくと判断がさらに速くなる。'
    }
  };

  const picked = TYPES[typeKey];

  return {
    typeKey,
    typeTitle: picked.title,
    tagline: picked.tagline,
    style: picked.style,
    jobs: picked.jobs,
    advice: picked.advice,
    barnum: barnumComments(ans, picked.title.replace(/💪|🧭|🧩/g, '').trim()),
    motivationTop3: ans.q3 // 選択順＝順位
  };
}

// ===== 「当たってるかも？」（私生活寄りのバーナム効果） =====
function barnumComments(ans, typeRaw) {
  const out = [];
  const push = (t) => { if (t && !out.includes(t) && out.length < 3) out.push(t); };

  const pick = ans.q3 || [];
  const has = (kw) => pick.some(v => v.includes(kw));

  if (typeRaw.includes('チャレンジ')) {
    push('思い立ったらすぐ動きたくなる日がある。');
    push('フットワークが軽いと言われがち。');
  } else if (typeRaw.includes('計画')) {
    push('予定や段取りが見えると心が落ち着く。');
    push('道具や設定を整えると気分が上がる。');
  } else {
    push('状況を見て切り替えるのがわりと得意。');
  }

  if (has('承認')) push('誰かに見てもらえると、不思議と力が出る。');
  if (has('自由')) push('やることは自分で決めたい、と思う場面がある。');
  if (has('仲間')) push('同じ方向を見る仲間がいると、自然とテンションが上がる。');
  if (has('成長')) push('昨日より少し進んだ実感があると機嫌が良い。');
  if (has('安心')) push('いつもの場所や手順だとリズムに乗りやすい。');
  if (has('探究')) push('気になったら検索やメモが止まらない。');
  if (has('貢献')) push('「ありがとう」の一言で元気が戻る。');
  if (has('達成')) push('チェックが一つ消えるだけでスッキリする。');

  ['初対面でも空気を読むのはわりと得意なほう。',
   '一人の時間と誰かと一緒の時間、どちらも大切にしたいタイプ。',
   '気に入ったものは長く使うほう。'
  ].forEach(push);

  return out.slice(0, 3);
}

// ===== 結果カード描画 =====
function renderResultCard(result, prof, ans) {
  const wrap = $('#result');
  if (!wrap) return;

  const mot = (result.motivationTop3 || [])
    .map((m, i) => `${i + 1}位：${m}`).join(' / ');

  const meta = [
    ans.age ? `年齢:${ans.age}` : '',
    ans.gender ? `性別:${genderJa(ans.gender)}` : '',
    ans.mbti ? `MBTI:${ans.mbti}` : ''
  ].filter(Boolean).join(' / ');

  const jobsList = (result.jobs || []).map(j => `<li>${escapeHtml(j)}</li>`).join('');

  wrap.innerHTML = `
  <div class="card">
    <h3 class="ttl">【タイプ】 ${escapeHtml(result.typeTitle)}</h3>
    <p class="lead">${escapeHtml(result.tagline)}</p>

    <h4>【「あなた」ってこう✨】</h4>
    <ul class="dots">
      ${result.barnum.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
    </ul>

    <h4>【合う働き方⚡️】</h4>
    <p>${escapeHtml(result.style)}</p>

    <h4>【向いている職種の例💼】</h4>
    <ul class="dots">${jobsList}</ul>

    <h4>【あなたのやる気スイッチ💡】</h4>
    <p>${mot || '—'}</p>

    <h4>【アドバイス📝】</h4>
    <p>${escapeHtml(result.advice)}</p>

    <h4>今すぐ友達にシェア👇</h4>

    <div class="meta">${meta || '—'}</div>

    <div class="share">
      <button id="share-line" class="btn sub">LINEで送る</button>
      <button id="share-instagram" class="btn sub">Instagramでシェア</button>
      <button id="share-x" class="btn sub">Xで投稿</button>
      <button id="share-threads" class="btn sub">Threadsで投稿</button>
    </div>
  </div>`;

  // 再バインド
  $('#share-line')?.addEventListener('click', shareOnLINE);
  $('#share-instagram')?.addEventListener('click', shareToInstagram);
  $('#share-x')?.addEventListener('click', shareToX);
  $('#share-threads')?.addEventListener('click', shareToThreads);
}

// ===== サーバ送信 =====
async function sendAnswer(profile, answers, result) {
  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.userId,
        displayName: profile.displayName,
        answers,
        result,
        ts: new Date().toISOString()
      }),
      credentials: 'include',
      mode: 'cors'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (e) {
    console.warn('送信に失敗しましたが、表示は続行します。', e);
  }
}

/* ===== 共有（固定画像カード＋指定テキスト） ===== */

// 結果タイトル（タイプ名）を抜き出し
function getResultTitle() {
  return ($('#result .ttl')?.textContent || '').replace('【タイプ】','').trim() || '診断結果';
}

// 画像を File 化（Web Share の files 添付に使う）
async function fetchImageAsFile() {
  const res = await fetch(SHARE_IMAGE_URL, { cache: 'no-store' });
  const blob = await res.blob();
  return new File([blob], 'c_lab_share.png', { type: blob.type || 'image/png' });
}

// 1) LINE：画像＋本文を投げる → ダメなら画像だけ → さらにダメなら外部タブ＋コピー
async function shareOnLINE() {
  const imgUrl = SHARE_IMAGE_URL;
  const text = CAPTION(getResultTitle());

  // LINEアプリ外 or API未対応なら画像を開いて本文コピー
  if (!liff.isInClient() || !liff.isApiAvailable('shareTargetPicker')) {
    try { await navigator.clipboard.writeText(text); } catch {}
    await liff.openWindow({ url: imgUrl, external: true });
    alert('画像を開きました。本文はコピー済みです。LINEで貼り付けて送ってください。');
    return;
  }

  try {
    // まず「本文＋画像」の2メッセージを送る
    await liff.shareTargetPicker([
      { type: 'text',  text },
      { type: 'image', originalContentUrl: imgUrl, previewImageUrl: imgUrl }
    ]);
    alert('LINEの投稿画面を開きました。送信してください。');
  } catch (e) {
    // 一部端末でエラーになる場合は画像だけにフォールバック
    try {
      await liff.shareTargetPicker([{ type: 'image', originalContentUrl: imgUrl, previewImageUrl: imgUrl }]);
      try { await navigator.clipboard.writeText(text); } catch {}
      alert('画像だけ送ります。本文はコピー済みなので貼り付けてください。');
    } catch (e2) {
      // 最終フォールバック
      try { await navigator.clipboard.writeText(text); } catch {}
      await liff.openWindow({ url: imgUrl, external: true });
      alert('共有でエラー。画像を開くので保存→本文を貼り付けて送ってください。');
    }
  }
}

// 2) Instagram：Web Share で画像＋本文 → 非対応は画像を開いて本文コピー
async function shareToInstagram() {
  const caption = CAPTION(getResultTitle());
  // Web Share (files) が使えるなら最優先
  try {
    const file = await fetchImageAsFile();
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: caption, title: 'C Lab' });
      return;
    }
  } catch (_) {}
  // フォールバック：画像タブ＋本文コピー
  try { await navigator.clipboard.writeText(caption); } catch {}
  window.open(SHARE_IMAGE_URL, '_blank');
  alert('画像を開きました。本文はコピー済みです。Instagramで貼り付けてください。');
}

// 3) X（旧Twitter）：files 共有できればそれ、不可なら intent（テキスト＋URL）
async function shareToX() {
  const text = `${CAPTION(getResultTitle())} ${LANDING_URL}`;
  try {
    const file = await fetchImageAsFile();
    if (navigator.canShare?.({ files: [file], text })) {
      await navigator.share({ files: [file], text, title: 'C Lab' });
      return;
    }
  } catch (_) {}
  // intent では画像を添付できないため、テキスト＋URLで投稿画面を開く
  location.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

// 4) Threads：files 共有できればそれ、不可なら intent（テキストのみ）
async function shareToThreads() {
  const text = `${CAPTION(getResultTitle())} ${LANDING_URL}`;
  try {
    const file = await fetchImageAsFile();
    if (navigator.canShare?.({ files: [file], text })) {
      await navigator.share({ files: [file], text, title: 'C Lab' });
      return;
    }
  } catch (_) {}
  location.href = `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`;
}

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', () => {
  initLIFF().catch(e => console.error(e));
});
