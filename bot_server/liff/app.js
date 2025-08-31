/* =========================
   C by me｜かんたん診断（LIFF）
   - 既存UIそのまま
   - 回答送信→/api/answer
   - 結果表示カード
   - 共有（LINE / Web Share）
   - 「当たってるかも？」は私生活寄りのバーナム文
   ========================= */

// ★ あなたの LIFF ID を入れてください（LINE DevelopersのLIFF ID）
const LIFF_ID = '2008019437-Jxwm33XM';

// ====== ヘルパ ======
const $ = (sel, p = document) => p.querySelector(sel);
const $$ = (sel, p = document) => Array.from(p.querySelectorAll(sel));

// フォーム値の取得
function valRadio(name) {
  const v = $(`input[name="${name}"]:checked`);
  return v ? v.value : null;
}
function valsCheckedOrdered(name) {
  // チェック順（dataset.order）で並べ替えて最大3件
  const boxes = $$(`input[name="${name}"]:checked`)
    .sort((a, b) => (Number(a.dataset.order || 9e9) - Number(b.dataset.order || 9e9)));
  return boxes.slice(0, 3).map(b => b.value);
}

// ====== LIFF init ======
async function initLIFF() {
  $('#status') && ($('#status').textContent = 'LIFF 初期化中…');
  await liff.init({ liffId: LIFF_ID });

  // LINE外のブラウザはログインさせる（開発時の直叩き用）
  if (!liff.isInClient() && !liff.isLoggedIn()) {
    $('#status') && ($('#status').textContent = 'ログインへリダイレクトします…');
    return liff.login();
  }

  const prof = await liff.getProfile();
  $('#displayName') && ($('#displayName').textContent = prof.displayName || '');
  $('#userId') && ($('#userId').textContent = prof.userId || '');

  // モチベ多選の“選択順”トラッキング
  setupMotivationOrder();

  // 実行ボタン
  $('#run') && $('#run').addEventListener('click', async () => {
    const answers = collectAnswers();
    // 簡易バリデーション
    const required = ['q1','q2','q4','q5','q6','q7','q8'];
    for (const k of required) {
      if (!answers[k]) {
        alert('未回答の設問があります。');
        return;
      }
    }
    if (!answers.q3.length) {
      alert('「やる気スイッチ」を1つ以上選んでください。');
      return;
    }

    const result = buildResult(answers);
    renderResultCard(result, prof, answers);
    await sendAnswer(prof, answers, result);
  });

  // 共有ボタン
  $('#share-line') && $('#share-line').addEventListener('click', shareOnLINE);
  $('#share-system') && $('#share-system').addEventListener('click', shareSystem);

  $('#status') && ($('#status').textContent = '読み込み完了');
}

// “やる気スイッチ”のチェック順を記録
function setupMotivationOrder() {
  let order = 1;
  $$('input[name="q3"]').forEach(box => {
    box.addEventListener('change', () => {
      if (box.checked) {
        // 3つまで
        const current = $$('input[name="q3"]:checked');
        if (current.length > 3) {
          box.checked = false;
          return alert('選べるのは最大3つまでです。');
        }
        // 初めてチェックされたら順番を付与
        if (!box.dataset.order) {
          box.dataset.order = String(order++);
        }
      } else {
        // 外したら順番をクリア
        box.dataset.order = '';
      }
    });
  });
}

// ====== 回答収集 ======
function collectAnswers() {
  return {
    // A/B 設問
    q1: valRadio('q1'), // 仕事の進め方
    q2: valRadio('q2'), // 判断の決め手
    q4: valRadio('q4'), // 苦手な環境
    q5: valRadio('q5'), // 感情の出し方
    q6: valRadio('q6'), // 安心できるチーム
    q7: valRadio('q7'), // チームでの役割
    q8: valRadio('q8'), // 働き方の理想
    // 多選（最大3／順序あり）
    q3: valsCheckedOrdered('q3'),
    // プロフィール（プルダウン）
    age: ($('#age') && $('#age').value) || '',
    gender: ($('#gender') && $('#gender').value) || '',
    mbti: ($('#mbti') && $('#mbti').value) || ''
  };
}

// ====== 診断ロジック ======
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

// ====== 「当たってるかも？」（私生活寄りのバーナム効果） ======
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

// ====== 結果カード描画 ======
function renderResultCard(result, prof, ans) {
  const wrap = $('#result');
  if (!wrap) return;

  const mot = result.motivationTop3
    .map((m, i) => `${i + 1}位：${m}`).join(' / ');

  const meta = [
    ans.age ? `年齢:${ans.age}` : '',
    ans.gender ? `性別:${ans.gender}` : '',
    ans.mbti ? `MBTI:${ans.mbti}` : ''
  ].filter(Boolean).join(' / ');

  wrap.innerHTML = `
  <div class="card">
    <h3 class="ttl">【タイプ】 ${result.typeTitle}</h3>
    <p class="lead">${escapeHtml(result.tagline)}</p>

    <h4>【当たってるかも？ポイント】</h4>
    <ul class="dots">
      ${result.barnum.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
    </ul>

    <h4>【合う働き方】</h4>
    <p>${escapeHtml(result.style)}</p>

    <h4>【向いている職種の例】</h4>
    <p>${escapeHtml(result.jobs)}</p>

    <h4>【あなたのやる気スイッチ（順位）】</h4>
    <p>${mot || '—'}</p>

    <h4>【アドバイス】</h4>
    <p>${escapeHtml(result.advice)}</p>

    <div class="meta">送信: 成功 / ${meta || '—'}</div>

    <div class="share">
      <button id="share-line" class="btn sub">LINEで送る</button>
      <button id="share-system" class="btn sub">他アプリでシェア</button>
    </div>
  </div>`;

  // 再バインド（上でDOMを入れ替えたため）
  $('#share-line') && $('#share-line').addEventListener('click', shareOnLINE);
  $('#share-system') && $('#share-system').addEventListener('click', shareSystem);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]
  ));
}

// ====== サーバ送信 ======
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

// ====== 共有 ======
async function shareOnLINE() {
  try {
    const text = buildShareTextFromCard();
    if (liff.isApiAvailable('shareTargetPicker')) {
      await liff.shareTargetPicker([{ type: 'text', text }]);
    } else {
      await liff.sendMessages([{ type: 'text', text }]);
    }
    alert('LINEにシェアしました。');
  } catch (e) {
    console.warn(e);
    alert('LINE共有に失敗しました。');
  }
}
async function shareSystem() {
  const text = buildShareTextFromCard();
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (_) {}
  } else {
    await navigator.clipboard.writeText(text);
    alert('本文をコピーしました。お好みのアプリに貼り付けてください。');
  }
}
function buildShareTextFromCard() {
  const card = $('#result .card');
  const title = card ? card.querySelector('.ttl')?.textContent?.trim() : '診断結果';
  const lines = Array.from(card?.querySelectorAll('h4, p, ul li') || [])
    .slice(0, 12).map(el => '・' + el.textContent.trim());
  return `C by me｜かんたん診断\n${title}\n${lines.join('\n')}\n#Cbyme`;
}

// ====== 起動 ======
document.addEventListener('DOMContentLoaded', () => {
  try { initLIFF(); } catch (e) { console.error(e); }
});
