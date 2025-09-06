 /* =========================
     C Lab｜個性チェック
     - 回答送信→ /api/answer（分析向けv2）
     - 生ログ + 整形 + 正規化保存（冪等キーつき）
     - 結果カード & 共有
     ========================= */

  // ★ あなたの LIFF ID を入れてください（LINE Developers の LIFF ID）
  const LIFF_ID = '2008019437-Jxwm33XM';
  // ★ 追加：LINEアプリで開き直すための LIFF URL
  const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

  // 固定シェア画像（/liff/assets/c_lab_share.png を公開配信）
  const SHARE_IMAGE_URL =
  `${location.origin}/liff/assets/c_lab_share.png?v=1`;

  // 共有時に一緒に載せる着地点（必要なら使う）
  const LANDING_URL = location.origin + '/liff/index.html';

  // ▼性別セレクト(#gender)から一人称を決める
  function getPronounFromGender() {
    const g = document.querySelector('#gender')?.value || '';
    if (g === 'male')   return 'ぼく';
    if (g === 'female') return 'わたし';
    return 'わたし';
  }

  // ▼共有文面
  const CAPTION_LINE   = (title) =>
    `１０秒でわかる、あなたの「個性」。${getPronounFromGender()}は『${ti
  tle}』だった！やってみて！`;
  const CAPTION_OTHERS = (title) =>
    `１０秒でわかる、あなたの「個性」。${getPronounFromGender()}は『${ti
  tle}』だった！みんなは？👇 #CLab #Cbyme #個性チェック`;

  // ===== ヘルパ =====
  const $  = (sel, p = document) => p.querySelector(sel);
  const $$ = (sel, p = document) => Array.from(p.querySelectorAll(sel));

  function valRadio(name) {
    const v = $(`input[name="${name}"]:checked`);
    return v ? v.value : null;
  }
  function valsCheckedOrdered(name) {
    return $$(`input[name="${name}"]:checked`)
      .sort((a, b) => Number(a.dataset.order || 9e9) -
  Number(b.dataset.order || 9e9))
      .slice(0, 3)
      .map(b => b.value);
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (m) =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
    );
  }
  const genderJa = (g) => g === 'male' ? '男性' : g === 'female' ?
  '女性' : g === 'other' ? 'その他' : '—';

  // ===== Q3モチベーション同期関数 =====
  function syncMotivationHidden() {
    const hiddenContainer = $('#q3-hidden');
    if (!hiddenContainer) return;

    // 全てのチェックボックスをクリア
    $$('input[name="q3"]', hiddenContainer).forEach(checkbox => {
      checkbox.checked = false;
      delete checkbox.dataset.order;
    });

    // mot1, mot2, mot3の値を取得してチェックボックスに同期
    ['mot1', 'mot2', 'mot3'].forEach((motId, index) => {
      const select = $(`#${motId}`);
      if (!select || !select.value) return;

      const checkbox = $(`input[name="q3"][value="${select.value}"]`,
  hiddenContainer);
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dataset.order = (index + 1).toString();
      }
    });

    console.log('[sync] Q3 motivation synchronized:',
  valsCheckedOrdered('q3'));
  }

  // ===== LIFF init =====
  async function initLIFF() {
    try {
      $('#status') && ($('#status').textContent = 'LIFF 初期化中…');

      // 防御: LIFFが使えない環境でもエラーで止まらない
      if (typeof window.liff === 'undefined') {
        throw new Error('LIFF SDK not available');
      }

    await liff.init({ liffId: LIFF_ID });

    // ★ LINEアプリ外なら、共有ボタンを「LINEで開き直す」に差し替え
    if (!liff.isInClient()) {
      $('#status').textContent = 'LINEアプリで開くと共有できます';
      const btn = $('#share-line');
      if (btn) {
        btn.textContent = 'LINEで開き直す';
        btn.onclick = () => { location.href = LIFF_URL; };
      }
      // Webブラウザでもプロフィール取得のためにログインだけは実施
      if (!liff.isLoggedIn()) return liff.login();
    } else {
      // LINEアプリ内：未ログインなら同意画面へ（chat_message.write
  の再同意含む）
      if (!liff.isLoggedIn()) return liff.login();
    }

      const prof = await liff.getProfile();
      window.currentProfile = prof;
      $('#status').textContent = '読み込み完了';

      setupFormHandlers(prof);
    } catch (e) {
      console.error('LIFF initialization error:', e);
      // LIFF初期化失敗時でもフォームを動作させる
      const dummyProfile = {
        userId: 'liff-init-failed-' + Date.now(),
        displayName: 'LIFFエラーユーザー',
        pictureUrl: null
      };
      window.dummyProfile = dummyProfile;
      setupFormHandlers(dummyProfile);
      $('#status').textContent = 'LIFF初期化失敗（ブラウザモード）';
      throw e; // 再 throwしてcatchブロックで処理
    }
  }

  // ===== フォームハンドラー設定 =====
  function setupFormHandlers(prof) {
    const form = $('#personalityForm');
    if (form) {
      form.addEventListener('submit', (e) => onSubmit(e, prof));
    }

    $('#run')?.addEventListener('click', async (e) => {
      e.preventDefault();
      // form.submit確実発火（requestSubmitフォールバック付き）
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          // フォールバック: dispatchEvent
          form.dispatchEvent(new Event('submit', { cancelable: true,
  bubbles: true }));
        }
      } else {
        // フォームが見つからない場合の直接実行
        await onSubmit(e, prof || window.dummyProfile || { userId:
  'anonymous', displayName: 'Anonymous' });
      }
    });
  }

  async function onSubmit(e, prof) {
    e.preventDefault();

    // 送信前に最新状態で同期
    syncMotivationHidden();

    // バリデーション
    if (!validateForm()) return;

    const answers = collectAnswers();

    const result = buildResult(answers);
    renderResultCard(result, prof, answers);

    // 結果エリアを表示、進捗100%、ステータス更新
    const resultEl = $('#result');
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.scrollIntoView({ behavior: 'smooth' });
    }

    // 進捗バー100%とステータス更新
    const progressEl = $('#progress');
    if (progressEl) progressEl.style.width = '100%';
    const statusEl = $('#status');
    if (statusEl) statusEl.textContent = '診断完了！';

    // デバッグ出力
    console.log('[dryrun] payload:', {
      answers: {
        ab: { q1:answers.q1, q2:answers.q2, q4:answers.q4,
  q5:answers.q5, q6:answers.q6, q7:answers.q7, q8:answers.q8 },
        motivation_ordered: answers.q3
      },
      demographics: { gender: answers.gender, age: answers.age, mbti:
  answers.mbti },
      profile: prof
    });

    await sendAnswer(prof, answers, result); // ← v2
  送信（生/整/正の3保存 & 冪等）
  }

  function validateForm() {
    const answers = collectAnswers();

    // 必須AB設問チェック
    const requiredAB = ['q1','q2','q4','q5','q6','q7','q8'];
    for (const k of requiredAB) {
      if (!answers[k]) {
        alert('未回答の設問があります。');
        return false;
      }
    }

    // Q3チェック
    if (!answers.q3.length) {
      alert('「やる気が出る理由」を1つ以上選んでください。');
      return false;
    }

    // プロフィールチェック
    if (!answers.gender || !answers.age) {
      alert('性別と年齢を入力してください。');
      return false;
    }

    return true;
  }

  // ===== 回答収集 =====
  function collectAnswers() {
    const age    = $('#age')?.value || '';
    const gender = $('#gender')?.value || '';
    const mbti   = $('#mbti')?.value || '';

    return {
      q1: valRadio('q1'),
      q2: valRadio('q2'),
      q4: valRadio('q4'),
      q5: valRadio('q5'),
      q6: valRadio('q6'),
      q7: valRadio('q7'),
      q8: valRadio('q8'),
      q3: valsCheckedOrdered('q3'),
      age, gender, mbti
    };
  }

  // ===== 診断ロジック =====
  function buildResult(ans) {
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
        tagline: '思い立ったらすぐ動ける！まずやってみて、直しながら前へ
  進むのが得意。',
        style: 'スピード感のある環境／小さく試して改善していく働き方',
        jobs: [
          '企画・プロデュース（新しい案を形にする）',
          'セールス／提案（訪問・オンライン）',
          '広報・SNS運用（発信して人を集める）',
          'イベント運営・プロモーション',
          '新サービスづくり（試作・PoC）',
          '取材・インタビュー（現場で動いて集める）'
        ],
        advice: '走り出しは強み。あとで「なぜそうしたか」を一言メモに残
  すと説得力UP。小さなゴールを細かく刻むと達成感が積み上がる。'
      },
      plan: {
        title: '計画ていねいタイプ🧭',
        tagline:
  '全体像を整理してから進むほうが力を発揮！再現性や安定感が武器。',
        style: '見通しが立つ環境／手順やルールを整えて進める働き方',
        jobs: [
          '事務・総務（書類／備品／スケジュール管理）',
          '経理アシスタント（伝票チェック・支払処理）',
          'データ入力・データ整備',
          '品質管理・検査（チェックリストで確認）',
          '資料作成（Excel・PowerPoint）',
          '在庫／発注管理（コツコツ把握してズレを防ぐ）'
        ],
        advice: '最初に段取りを書き出すと安心感とスピードが両立。区切り
  ごとに振り返りをルーチン化すると成果が伸びる。'
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
      barnum: barnumComments(ans, picked.title.replace(/💪|🧭|🧩/g,
  '').trim()),
      motivationTop3: ans.q3
    };
  }

  // ===== 「当たってるかも？」（私生活寄りのバーナム効果） =====
  function barnumComments(ans, typeRaw) {
    const out = [];
    const push = (t) => { if (t && !out.includes(t) && out.length < 3)
  out.push(t); };

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
    if (has('自由'))
  push('やることは自分で決めたい、と思う場面がある。');
    if (has('仲間'))
  push('同じ方向を見る仲間がいると、自然とテンションが上がる。');
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

    const jobsList = (result.jobs || []).map(j =>
  `<li>${escapeHtml(j)}</li>`).join('');

    wrap.innerHTML = `
    <div class="card">
      <h3 class="ttl">【タイプ】 ${escapeHtml(result.typeTitle)}</h3>
      <p class="lead">${escapeHtml(result.tagline)}</p>

      <h4>【「あなた」の個性✨】</h4>
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

      <h4>👇今すぐ友達にシェア👇</h4>

      <div class="share">
        <button id="share-line"   class="btn sub">LINEで送る</button>
        <button id="share-system" class="btn
  sub">ほかのアプリでシェア</button>
      </div>
    </div>`;

    // 結果表示後の処理: display:block、progress:100%、status更新
    const resultEl = $('#result');
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.scrollIntoView({ behavior: 'smooth' });
    }
    const progressEl = $('#progress');
    if (progressEl) progressEl.style.width = '100%';
    const statusEl = $('#status');
    if (statusEl) statusEl.textContent = '診断完了！';

    // 再バインド（↑でDOMを入れ替えたため）
    $('#share-line')?.addEventListener('click', shareOnLINE);
    $('#share-system')?.addEventListener('click', shareOtherApps);
  }

  /* ========= 分析用：スコア再計算 ========= */
  // 回答から challenge/plan を再計算（分析用に保持）
  function computeScoring(ab) {
    let challenge = 0, plan = 0;
    if (ab.q1 === 'A') challenge++; else if (ab.q1 === 'B') plan++;
    if (ab.q2 === 'A') challenge++; else if (ab.q2 === 'B') plan++;
    if (ab.q5 === 'A') challenge++; else plan++;
    if (ab.q6 === 'A') challenge++; else plan++;
    if (ab.q7 === 'A') challenge++; else plan++;
    if (ab.q8 === 'B') challenge++; else plan++;
    const typeKey = (challenge - plan >= 2) ? 'challenge' : (plan -
  challenge >= 2) ? 'plan' : 'balance';
    return { challenge, plan, typeKey };
  }

  /* ===== サーバ送信（構造化 v2 フォーマット） ===== */
  async function sendAnswer(profile, answers, result) {
    // A/B 回答だけを取り出して構造化
    const ab = { q1:answers.q1, q2:answers.q2, q4:answers.q4,
  q5:answers.q5, q6:answers.q6, q7:answers.q7, q8:answers.q8 };
    const scoring = computeScoring(ab);

    // 冪等キー（再送での二重カウント防止）
    const submissionId =
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID ===
  'function')
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const payload = {
      submission_id: submissionId,
      line: {
        userId: profile.userId,
        displayName: profile.displayName || null,
        pictureUrl: profile.pictureUrl || null
      },
      demographics: {
        gender: answers.gender || null,
        age: answers.age ? Number(answers.age) : null,
        mbti: answers.mbti || null
      },
      answers: {
        ab,
        motivation_ordered: answers.q3 || []
      },
      scoring, // {challenge, plan, typeKey}
      result: {
        typeKey:  result.typeKey,
        typeTitle: result.typeTitle,
        tagline:  result.tagline,
        style:    result.style,
        jobs:     result.jobs,
        advice:   result.advice
      },
      barnum: result.barnum || [],
      meta: {
        ts: new Date().toISOString(),
        ua: navigator.userAgent,
        liffId: typeof LIFF_ID !== 'undefined' ? LIFF_ID : null,
        app: 'c-lab-liff',
        v: '2025-09'
      },
      client_v: 'web-2025-09'
    };

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
        mode: 'cors'
      });
      let json = {};
      try { json = await res.json(); } catch (_) {}
      if (!res.ok) {
        console.error('POST /api/answer failed:', res.status, json);
        alert(`送信エラー: ${res.status}\n${json?.error ||
  '詳細はコンソールを見て'}`);
        throw new Error(`HTTP ${res.status}: ${json?.error || 'unknown
  error'}`);
      } else {
        console.log('POST /api/answer ok:', json);
      }
    } catch (e) {
      console.warn('送信に失敗しましたが、表示は続行します。', e);
    }
  }

  /* ===== 共有（固定画像カード＋指定テキスト） ===== */

  // 結果タイトル（タイプ名）を抜き出し
  function getResultTitle() {
    return ($('#result .ttl')?.textContent ||
  '').replace('【タイプ】','').trim() || '診断結果';
  }

  // 画像を File 化（Web Share の files 添付に使う）
  async function fetchImageAsFile() {
    const res = await fetch(SHARE_IMAGE_URL, { cache: 'no-store' });
    const blob = await res.blob();
    return new File([blob], 'c_lab_share.png', { type: blob.type ||
  'image/png' });
  }

  // 1)
  LINE：送信先を選んで「本文＋画像」を送る（アプリ外ならLIFFを開き直す）
  async function shareOnLINE() {
    const imgUrl = SHARE_IMAGE_URL;
    const text   = CAPTION_LINE(getResultTitle());

    // ★ LINEアプリ外 → LIFFで開き直す（外部サイト遷移はしない）
    if (!liff.isInClient()) {
      alert('LINEアプリで開くと、画像と文面をそのまま送れます。');
      location.href = LIFF_URL;
      return;
    }

    // アプリ内：送信先ピッカーで「本文＋画像」
    try {
      if (!liff.isApiAvailable('shareTargetPicker')) throw new
  Error('shareTargetPicker unavailable');
      await liff.shareTargetPicker([
        { type: 'text',  text },
        { type: 'image', originalContentUrl: imgUrl, previewImageUrl:
  imgUrl }
      ]);
    } catch (e) {
      console.warn('shareTargetPicker error -> fallback to image only',
  e);
      try {
        await liff.shareTargetPicker([{ type: 'image',
  originalContentUrl: imgUrl, previewImageUrl: imgUrl }]);
        try { await navigator.clipboard.writeText(text); } catch {}

  alert('画像だけ送ります。本文はコピー済みなので貼り付けてください。');
      } catch (e2) {
        try { await navigator.clipboard.writeText(text); } catch {}
        alert('共有に失敗しました。トークで本文を貼り付け、画像を添付し
  て送ってください。');
      }
    }
  }

  // 2) ほかのアプリまとめ：Web Share（画像＋本文）→
  画像タブ＋本文コピー
  async function shareOtherApps() {
    const caption = CAPTION_OTHERS(getResultTitle());

    // Web Share + files が使える端末なら、Instagram / X / Threads
  などをここから共有
    try {
      const file = await fetchImageAsFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption, title: 'C
  Lab' });
        return;
      }
    } catch (_) {}

    // フォールバック：画像を別タブで開き、本文をクリップボードへ
    try { await navigator.clipboard.writeText(caption); } catch {}
    window.open(SHARE_IMAGE_URL, '_blank');
    alert('画像を開きました。本文はコピー済みです。お好みのアプリで貼り
  付けてください。');
  }

  // ===== 進捗バー更新 =====
  function updateProgress() {
    const progressEl = $('#progress');
    if (!progressEl) return;

    // 回答状況チェック
    const answers = collectAnswers();
    const requiredFields = ['gender', 'age', 'q1', 'q2', 'q4', 'q5',
  'q6', 'q7', 'q8'];
    const completedCount = requiredFields.filter(field =>
  answers[field]).length;
    const hasQ3 = answers.q3.length > 0;

    const totalRequired = requiredFields.length + 1; // +1 for Q3
    const completed = completedCount + (hasQ3 ? 1 : 0);
    const percentage = Math.round((completed / totalRequired) * 100);

    progressEl.style.width = `${percentage}%`;
    console.log(`[progress] ${completed}/${totalRequired}
  (${percentage}%)`);
  }

  // ===== 起動 =====
  document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の存在確認とログ出力
    const requiredElements = ['#personalityForm', '#run', '#status',
  '#progress', '#result'];
    requiredElements.forEach(selector => {
      const el = $(selector);
      console.log(`DOM check: ${selector} -> ${el ? 'OK' : 'NOT
  FOUND'}`);
    });

    // モチベーション同期の初期設定（LIFF外でも動作）
    ['mot1', 'mot2', 'mot3'].forEach(motId => {
      const select = $(`#${motId}`);
      if (select) {
        select.addEventListener('change', () => {
          syncMotivationHidden();
          updateProgress();
        });
        console.log(`Event bound: ${motId} change listener`);
      }
    });

    // 年齢・性別・設問のchangeで進捗バー更新
    const progressFields = ['#gender', '#age', 'input[name="q1"]',
  'input[name="q2"]', 'input[name="q4"]', 'input[name="q5"]',
  'input[name="q6"]', 'input[name="q7"]', 'input[name="q8"]'];
    progressFields.forEach(selector => {
      $$(selector).forEach(el => {
        el.addEventListener('change', updateProgress);
      });
    });

    // 初回同期実行
    syncMotivationHidden();
    updateProgress();

    // LIFF初期化（エラーがあっても表示は継続）
    if (typeof window.liff !== 'undefined') {
      initLIFF().catch(e => {
        console.error('LIFF initialization failed:', e);
        $('#status').textContent =
  'ブラウザモード（LINEアプリでの利用を推奨）';
        // LIFF失敗時でもフォームは動作させる
        const dummyProfile = {
          userId: 'liff-failed-' + Date.now(),
          displayName: 'LIFFユーザー',
          pictureUrl: null
        };
        window.dummyProfile = dummyProfile;
        setupFormHandlers(dummyProfile);
      });
    } else {
      $('#status').textContent = 'ブラウザモード（LIFF SDK未読込）';
      console.warn('LIFF SDK not loaded - running in browser mode');

      // LIFF未読込時のダミープロフィールとフォームハンドラー設定
      const dummyProfile = {
        userId: 'browser-user-' + Date.now(),
        displayName: 'ブラウザユーザー',
        pictureUrl: null
      };
      window.dummyProfile = dummyProfile;
      setupFormHandlers(dummyProfile);
      console.log('[browser mode] Form handlers set up with dummy
  profile:', dummyProfile);
    }
  });
