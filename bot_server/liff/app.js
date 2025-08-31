// ===== 設定：ここに LIFF ID を入れる =====
const LIFF_ID = 'ここにLIFF_IDを入れる';

// ------------- ヘルパ -------------
const $ = (s) => document.querySelector(s);
const el = (tag, attrs={}, html='') => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k,v));
  if (html) n.innerHTML = html;
  return n;
};

// ------------- 設問定義（A/B×8問）-------------
const QUESTIONS = [
  { key:'q1', title:'1. 仕事の進め方は？', a:'とりあえず始めて直す', b:'整理してから始める' },
  { key:'q2', title:'2. 判断の決め手は？', a:'直感・フィーリング', b:'データや理由' },
  { key:'q3', title:'3. やる気が出る理由は？（1つ選択）',
    a:'成果達成/承認/貢献/安心/探究/自由/仲間/成長', b:'（Aから1つ選択）', multi:true },
  { key:'q4', title:'4. 苦手な環境は？', a:'細かく指示される', b:'丸投げされる' },
  { key:'q5', title:'5. 感情の出し方は？', a:'すぐ顔や言葉に出る', b:'外には出ないが心で燃える' },
  { key:'q6', title:'6. 安心できるチームは？', a:'何でもハッキリ言える', b:'空気を大事に和やか' },
  { key:'q7', title:'7. チームでの役割は？', a:'リーダー', b:'サポート' },
  { key:'q8', title:'8. 働き方の理想は？', a:'一つを極める', b:'色々挑戦する' },
];

// ------------- 画面生成 -------------
function renderQuestions() {
  const wrap = $('#qwrap'); wrap.innerHTML = '';
  QUESTIONS.forEach((q, idx) => {
    const sec = el('section');
    sec.append(el('div', {class:'muted'}, `Q${idx+1}: ${q.title}`));

    if (q.multi) {
      const opts = ['成果達成','承認','貢献','安心','探究','自由','仲間','成長'];
      const g = el('div', {class:'grid'});
      opts.forEach((t, i) => {
        const id = `${q.key}-${i}`;
        const lab = el('label', {class:'opt', for:id});
        lab.append(el('input',{type:'checkbox',id,value:t}));
        lab.append(document.createTextNode(t));
        g.append(lab);
      });
      sec.append(g);
    } else {
      const idA = `${q.key}-a`, idB = `${q.key}-b`;
      const la = el('label',{class:'opt',for:idA});
      la.append(el('input',{type:'radio',name:q.key,id:idA,value:'A'}));
      la.append(document.createTextNode(`A. ${q.a}`));
      const lb = el('label',{class:'opt',for:idB});
      lb.append(el('input',{type:'radio',name:q.key,id:idB,value:'B'}));
      lb.append(document.createTextNode(`B. ${q.b}`));
      sec.append(la, lb);
    }
    wrap.append(sec);
  });
}

// ------------- 集計ロジック（やさしい日本語の結果文） -------------
function scoreAndExplain(ans) {
  // A/Bの比率でタイプを出す（シンプル）
  const abKeys = ['q1','q2','q4','q5','q6','q7','q8'];
  let a=0,b=0;
  abKeys.forEach(k => (ans[k]==='A'? a++ : b++));

  const type = a>b ? 'チャレンジ先行タイプ' : (a<b ? '計画ていねいタイプ' : 'バランスよしタイプ');

  const why =
    type==='チャレンジ先行タイプ'
      ? '思い立ったらすぐ動ける。まずやってみて、直しながら前へ進むのが得意。'
      : type==='計画ていねいタイプ'
      ? '準備や段取りを大切にできる。じっくり考えて、ムダなく進めるのが得意。'
      : '直感も計画もどちらも使える。状況に合わせて切り替えられるのが強み。';

  const fit =
    type==='チャレンジ先行タイプ'
      ? 'スピード感のある現場／小さく試して改善していく働き方'
      : type==='計画ていねいタイプ'
      ? '要件整理や計画・検証が大事な働き方／丁寧なコミュニケーション'
      : '状況に応じて実行も調整もできる役回り';

  const jobs =
    type==='チャレンジ先行タイプ'
      ? '企画、セールス、PdM、成長フェーズのスタートアップ'
      : type==='計画ていねいタイプ'
      ? 'バックオフィス、品質保証、データ分析、ドキュメンテーション'
      : 'カスタマーサクセス、進行管理、コンサル、コーディネーター';

  const adv =
    type==='チャレンジ先行タイプ'
      ? '走り出しは強み。あとで「なぜそうしたか」を一言メモに残すと説得力UP。'
      : type==='計画ていねいタイプ'
      ? '最初の一歩が重くなりがち。小さく始めて早めにフィードバックをもらうと◎。'
      : '得意なほうに寄りすぎないよう、意識してもう一方の視点も使おう。';

  return { type, why, fit, jobs, adv };
}

// ------------- バーナム効果コメント -------------
// できるだけ多くの人に当てはまる“当たってる感”の短文を、回答から3つ抽出。
function barnumComments(ans, type) {
  const picks = [];

  // 選択肢から拾う
  const m = new Set(ans.q3 || []);
  if (m.has('承認')) picks.push('がんばりを見てくれる人がいると、実力が一気に出るタイプ。');
  if (m.has('自由')) picks.push('自由度があると集中できるけど、締切があるとさらに加速する。');
  if (m.has('仲間')) picks.push('一人でも進められるけど、仲間と動くとやる気が長続きする。');
  if (m.has('成長')) picks.push('昨日より成長できた実感があると、次も自然と動ける。');
  if (m.has('安心')) picks.push('土台が安心だと、新しい挑戦にも踏み出しやすい。');
  if (m.has('探究')) picks.push('答えが出るまで深掘りしたくなる探究心を持っている。');
  if (m.has('貢献')) picks.push('「誰かの役に立てた」がやる気のスイッチになりやすい。');
  if (m.has('成果達成')) picks.push('小さな達成でも積み重ねるほど自信がつくタイプ。');

  // タイプ別に“広く刺さる”一言
  if (type === 'チャレンジ先行タイプ') {
    picks.push('思い切りがある一方で、ちゃんと慎重に考える場面もある。');
  } else if (type === '計画ていねいタイプ') {
    picks.push('準備は大事。でも動き出すと決めたら意外と行動が速い。');
  } else {
    picks.push('状況を見て、直感と計画をうまく切り替えられる。');
  }

  // 共通の“誰でも思い当たる”補完（重複しないように追加）
  const commons = [
    '頼られると断りづらいけど、最後はきちんとやり切る。',
    '新しいことはワクワクするが、同時に上手くいくか少し不安にもなる。',
    '周りからは落ち着いて見られがちでも、内側ではちゃんと悩んでから決める。'
  ];
  commons.forEach(t => { if (picks.length < 5 && !picks.includes(t)) picks.push(t); });

  // 3つだけ返す（順番は前の方がユーザー固有度が高い）
  return picks.slice(0, 3);
}

// ------------- フォーム収集 -------------
function collectAnswers() {
  const get = (name) => {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    return r ? r.value : null;
  };
  const mul = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(i=>i.value);

  return {
    q1: get('q1'), q2: get('q2'),
    q3: mul,
    q4: get('q4'), q5: get('q5'),
    q6: get('q6'), q7: get('q7'), q8: get('q8'),
  };
}

// ------------- LIFF 初期化 & 送信 -------------
async function init() {
  $('#status').textContent = 'LIFF 初期化中…';
  await liff.init({ liffId: LIFF_ID });

  if (!liff.isLoggedIn()) {
    $('#status').textContent = 'ログインへリダイレクトします…';
    return liff.login();
  }

  const prof = await liff.getProfile();
  const idt  = liff.getDecodedIDToken();
  $('#status').innerHTML = `ようこそ <b>${prof.displayName}</b> さん！ <span class="pill">${liff.isInClient()?'トーク内':'外部ブラウザ'}</span>`;

  renderQuestions();

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#submit').disabled = true;

    const answers = collectAnswers();
    const demographics = {
      gender: $('#gender').value || '',
      age:    $('#age').value || '',
      mbti:   $('#mbti').value || '',
    };

    const missing = ['q1','q2','q4','q5','q6','q7','q8'].filter(k => !answers[k]);
    if (missing.length) {
      alert('未回答の質問があります');
      $('#submit').disabled = false;
      return;
    }

    const result = scoreAndExplain(answers);
    const barnums = barnumComments(answers, result.type);

    // 運営側へ送信（/api/answer）
    try {
      const payload = {
        line: {
          userId: prof.userId, displayName: prof.displayName,
          pictureUrl: prof.pictureUrl || null, email: idt?.email || null,
          inClient: liff.isInClient(), lang: liff.getLanguage()
        },
        demographics,
        answers,
        result,
        barnum: barnums,
        meta: { ts: new Date().toISOString(), ua: navigator.userAgent, v: 'liff-v2-barnum' }
      };

      const res = await fetch('/api/answer', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });

      // 画面に結果表示
      $('#r-type').textContent = result.type;
      $('#r-why').textContent  = result.why;
      $('#r-fit').textContent  = result.fit;
      $('#r-jobs').textContent = result.jobs;
      $('#r-adv').textContent  = result.adv;

      $('#r-barnum').innerHTML = barnums.map(t => `<li>${t}</li>`).join('');

      $('#r-meta').textContent =
        `送信: ${res.ok?'成功':'失敗'}  /  性別:${demographics.gender||'-'}  年齢:${demographics.age||'-'}  MBTI:${demographics.mbti||'-'}`;

      $('#resultCard').style.display = 'block';

      if (liff.isInClient()) {
        try {
          await liff.sendMessages([{
            type:'text',
            text:`診断結果: ${result.type}\n当たってるかも: ・${barnums.join('\n・')}\n合う働き方: ${result.fit}\n職種例: ${result.jobs}`
          }]);
        } catch (_) {}
      }
    } catch (err) {
      console.error(err);
      alert('送信に失敗しました。電波状況をご確認ください。');
    } finally {
      $('#submit').disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
