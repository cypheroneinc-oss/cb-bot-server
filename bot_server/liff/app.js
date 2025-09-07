/* =========================
   C Lab｜個性チェック（フロントのみ）
   - UI/文言は変更なし
   - 送信は /api/answer にPOST（JSON）
   ========================= */

const LIFF_ID  = '2008019437-Jxwm33XM';
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;
const SHARE_IMAGE_URL = `${location.origin}/liff/assets/c_lab_share.png?v=1`;
const LANDING_URL     = location.origin + '/liff/index.html';

// ---------- helpers ----------
const $  = (sel, p=document) => p.querySelector(sel);
const $$ = (sel, p=document) => Array.from(p.querySelectorAll(sel));
const escapeHtml = (s)=> String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const normalize = (s)=> String(s||'')
  .replace(/\u3000/g,' ')   // 全角スペース→半角
  .replace(/\s+/g,' ')      // 改行/連続空白→単一スペース
  .trim();

function getPronounFromGender(){
  const g = $('#gender')?.value || '';
  if (g==='male') return 'ぼく';
  if (g==='female') return 'わたし';
  return 'わたし';
}

const CAPTION_LINE = (title)=>
  `１０秒でわかる、あなたの「個性」。${getPronounFromGender()}は『${title}』だった！やってみて！`;
const CAPTION_OTHERS = (title)=>
  `１０秒でわかる、あなたの「個性」。${getPronounFromGender()}は『${title}』だった！みんなは？👇 #CLab #Cbyme #個性チェック`;

function valRadio(name){ const v = $(`input[name="${name}"]:checked`); return v?v.value:null; }
function valsCheckedOrdered(name){
  return $$(`input[name="${name}"]:checked`)
    .sort((a,b)=>Number(a.dataset.order||9e9)-Number(b.dataset.order||9e9))
    .slice(0,3).map(b=>b.value);
}

// ---------- Q3 同期（安全版） ----------
function syncMotivationHidden(){
  const hidden = $('#q3-hidden'); if(!hidden) return;
  // いったん全解除
  $$('input[name="q3"]', hidden).forEach(cb=>{ cb.checked=false; delete cb.dataset.order; });

  ['mot1','mot2','mot3'].forEach((id, idx)=>{
    const sel = document.getElementById(id);
    const v   = sel?.value;
    if(!v) return;
    const vN = normalize(v);
    const target = $$('input[name="q3"]', hidden).find(cb => normalize(cb.value)===vN);
    if(target){
      target.checked = true;
      target.dataset.order = String(idx+1);
    }
  });

  console.log('[sync] q3:', valsCheckedOrdered('q3'));
}

// ---------- LIFF init ----------
async function initLIFF(){
  try{
    if($('#status')) $('#status').textContent='LIFF 初期化中…';
    if(typeof window.liff==='undefined') throw new Error('LIFF SDK not available');

    await liff.init({ liffId: LIFF_ID });

    if(!liff.isInClient()){
      $('#status').textContent='LINEアプリで開くと共有できます';
      const btn = $('#share-line');
      if(btn){ btn.textContent='LINEで開き直す'; btn.onclick = ()=>{ location.href = LIFF_URL; }; }
      if(!liff.isLoggedIn()) return liff.login();
    }else{
      if(!liff.isLoggedIn()) return liff.login();
    }

    const prof = await liff.getProfile();
    window.currentProfile = prof;
    $('#status').textContent='読み込み完了';
    setupFormHandlers(prof);
  }catch(e){
    console.error('LIFF initialization error:', e);
    const dummy = { userId:'liff-init-failed-'+Date.now(), displayName:'LIFFエラーユーザー', pictureUrl:null };
    window.dummyProfile = dummy;
    setupFormHandlers(dummy);
    if($('#status')) $('#status').textContent='LIFF初期化失敗（ブラウザモード）';
  }
}

// ---------- フォーム ----------
function setupFormHandlers(profile){
  const form = $('#personalityForm');
  if(form){
    form.addEventListener('submit', (e)=> onSubmit(e, profile));
  }

  const runBtn = $('#run');
  if(runBtn){
    runBtn.addEventListener('click', (e)=>{
      e.preventDefault();
      if(form){
        if(typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { cancelable:true, bubbles:true }));
      }else{
        onSubmit(e, profile || window.dummyProfile || { userId:'anonymous', displayName:'Anonymous' });
      }
    });
  }
}

async function onSubmit(e, prof){
  e.preventDefault();

  // 最新状態へ同期
  syncMotivationHidden();

  // 検証
  if(!validateForm()){
    console.warn('[validate] failed');
    return;
  }

  const answers = collectAnswers();
  const result  = buildResult(answers);

  renderResultCard(result, prof, answers);
  console.log('[render] done, showing modal…');

  // 送信は後段・非同期（表示は阻害しない）
  sendAnswer(prof, answers, result).catch(err=>{
    console.warn('sendAnswer failed (display continues):', err);
  });
}

function validateForm(){
  const answers = collectAnswers();

  // AB必須
  for(const k of ['q1','q2','q4','q5','q6','q7','q8']){
    if(!answers[k]){ alert('未回答の設問があります。'); return false; }
  }
  // Q3
  if(!answers.q3.length){ alert('「やる気が出る理由」を1つ以上選んでください。'); return false; }
  // プロフィール
  if(!answers.gender || !answers.age){ alert('性別と年齢を入力してください。'); return false; }

  return true;
}

function collectAnswers(){
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

// ---------- 診断ロジック ----------
function buildResult(ans){
  let sChallenge=0, sPlan=0;
  if(ans.q1==='A') sChallenge++; else if(ans.q1==='B') sPlan++;
  if(ans.q2==='A') sChallenge++; else if(ans.q2==='B') sPlan++;
  if(ans.q5==='A') sChallenge++; else sPlan++;
  if(ans.q6==='A') sChallenge++; else sPlan++;
  if(ans.q7==='A') sChallenge++; else sPlan++;
  if(ans.q8==='B') sChallenge++; else sPlan++;

  let typeKey='balance';
  if(sChallenge - sPlan >= 2) typeKey='challenge';
  else if(sPlan - sChallenge >= 2) typeKey='plan';

  const TYPES = {
    challenge:{
      title:'チャレンジ先行タイプ💪',
      tagline:'思い立ったらすぐ動ける！まずやってみて、直しながら前へ進むのが得意。',
      style:'スピード感のある環境／小さく試して改善していく働き方',
      jobs:[
        '企画・プロデュース（新しい案を形にする）',
        'セールス／提案（訪問・オンライン）',
        '広報・SNS運用（発信して人を集める）',
        'イベント運営・プロモーション',
        '新サービスづくり（試作・PoC）',
        '取材・インタビュー（現場で動いて集める）'
      ],
      advice:'走り出しは強み。あとで「なぜそうしたか」を一言メモに残すと説得力UP。小さなゴールを細かく刻むと達成感が積み上がる。'
    },
    plan:{
      title:'計画ていねいタイプ🧭',
      tagline:'全体像を整理してから進むほうが力を発揮！再現性や安定感が武器。',
      style:'見通しが立つ環境／手順やルールを整えて進める働き方',
      jobs:[
        '事務・総務（書類／備品／スケジュール管理）',
        '経理アシスタント（伝票チェック・支払処理）',
        'データ入力・データ整備',
        '品質管理・検査（チェックリストで確認）',
        '資料作成（Excel・PowerPoint）',
        '在庫／発注管理（コツコツ把握してズレを防ぐ）'
      ],
      advice:'最初に段取りを書き出すと安心感とスピードが両立。区切りごとに振り返りをルーチン化すると成果が伸びる。'
    },
    balance:{
      title:'バランス型🧩',
      tagline:'状況を見て攻守を切り替えられるオールラウンダー！',
      style:'変化に強い環境／状況で役割を調整する働き方',
      jobs:[
        'プロジェクト進行管理（ディレクター／アシスタント）',
        'カスタマーサポート／ヘルプデスク',
        '人事・採用アシスタント（面談調整・連絡）',
        'コミュニティ運営・ファン対応',
        '学習サポート／塾TA・メンター',
        'シフト調整・現場リーダー（みんなを支える）'
      ],
      advice:'優先度の基準を1つ決めておくと判断がさらに速くなる。'
    }
  };

  const picked = TYPES[typeKey];

  return {
    typeKey,
    typeTitle: picked.title,
    tagline:  picked.tagline,
    style:    picked.style,
    jobs:     picked.jobs,
    advice:   picked.advice,
    barnum:   barnumComments(ans, picked.title.replace(/💪|🧭|🧩/g,'').trim()),
    motivationTop3: ans.q3
  };
}

function barnumComments(ans, typeRaw){
  const out=[]; const push=(t)=>{ if(t && !out.includes(t) && out.length<3) out.push(t); };
  const pick = ans.q3||[]; const has=(kw)=> pick.some(v=>v.includes(kw));

  if(typeRaw.includes('チャレンジ')){ push('思い立ったらすぐ動きたくなる日がある。'); push('フットワークが軽いと言われがち。'); }
  else if(typeRaw.includes('計画')){ push('予定や段取りが見えると心が落ち着く。'); push('道具や設定を整えると気分が上がる。'); }
  else { push('状況を見て切り替えるのがわりと得意。'); }

  if(has('承認')) push('誰かに見てもらえると、不思議と力が出る。');
  if(has('自由')) push('やることは自分で決めたい、と思う場面がある。');
  if(has('仲間')) push('同じ方向を見る仲間がいると、自然とテンションが上がる。');
  if(has('成長')) push('昨日より少し進んだ実感があると機嫌が良い。');
  if(has('安心')) push('いつもの場所や手順だとリズムに乗りやすい。');
  if(has('探究')) push('気になったら検索やメモが止まらない。');
  if(has('貢献')) push('「ありがとう」の一言で元気が戻る。');
  if(has('達成')) push('チェックが一つ消えるだけでスッキリする。');

  ['初対面でも空気を読むのはわりと得意なほう。',
   '一人の時間と誰かと一緒の時間、どちらも大切にしたいタイプ。',
   '気に入ったものは長く使うほう。'
  ].forEach(push);

  return out.slice(0,3);
}

// ---------- モーダル ----------
function showResultModal(){
  const modal = $('#result-modal');
  if(modal){
    modal.classList.add('show');
    document.body.style.overflow='hidden';
    console.log('[modal] show ->', modal.className);
  }
}
function hideResultModal(){
  const modal = $('#result-modal');
  if(modal){
    modal.classList.remove('show');
    document.body.style.overflow='';
  }
}

// ---------- 結果描画 ----------
function renderResultCard(result, prof, ans){
  const wrap = $('#result-content'); if(!wrap) return;

  const mot = (result.motivationTop3||[]).map((m,i)=>`${i+1}位：${m}`).join(' / ');
  const jobs = (result.jobs||[]).map(j=>`<li>${escapeHtml(j)}</li>`).join('');

  wrap.innerHTML = `
    <div class="card">
      <h3 class="ttl">【${escapeHtml(result.typeTitle)}】</h3>
      <p class="lead">${escapeHtml(result.tagline)}</p>

      <h4>「あなた」の個性✨</h4>
      <ul class="dots">${result.barnum.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul>

      <h4>かがやくはたらき方⚡️</h4>
      <p>${escapeHtml(result.style)}</p>

      <h4>向いているしごとの例💼</h4>
      <ul class="dots">${jobs}</ul>

      <h4>あなたのやる気スイッチ💡</h4>
      <p>${mot || '—'}</p>

      <h4>👇今すぐ友達にシェア👇</h4>
      <div class="share">
        <button id="share-line"   class="btn sub">LINEで送る</button>
        <button id="share-system" class="btn sub">ほかのアプリでシェア</button>
      </div>
    </div>`;

  // モーダル表示
  showResultModal();

  // 再バインド
  $('#share-line')?.addEventListener('click', shareOnLINE);
  $('#share-system')?.addEventListener('click', shareOtherApps);
}

// ---------- スコア（分析用） ----------
function computeScoring(ab){
  let challenge=0, plan=0;
  if(ab.q1==='A') challenge++; else if(ab.q1==='B') plan++;
  if(ab.q2==='A') challenge++; else if(ab.q2==='B') plan++;
  if(ab.q5==='A') challenge++; else plan++;
  if(ab.q6==='A') challenge++; else plan++;
  if(ab.q7==='A') challenge++; else plan++;
  if(ab.q8==='B') challenge++; else plan++;
  const typeKey = (challenge-plan>=2)?'challenge':(plan-challenge>=2)?'plan':'balance';
  return { challenge, plan, typeKey };
}

// ---------- 送信 ----------
async function sendAnswer(profile, answers, result){
  const ab = { q1:answers.q1, q2:answers.q2, q4:answers.q4, q5:answers.q5, q6:answers.q6, q7:answers.q7, q8:answers.q8 };
  const scoring = computeScoring(ab);
  const submissionId = (typeof crypto!=='undefined' && typeof crypto.randomUUID==='function')
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  const payload = {
    submission_id: submissionId,
    line: { userId: profile?.userId || null, displayName: profile?.displayName||null, pictureUrl: profile?.pictureUrl||null },
    demographics: { gender: answers.gender||null, age: answers.age?Number(answers.age):null, mbti: answers.mbti||null },
    answers: { ab, motivation_ordered: answers.q3||[] },
    scoring,
    result: {
      typeKey: result.typeKey, typeTitle: result.typeTitle, tagline: result.tagline,
      style: result.style, jobs: result.jobs, advice: result.advice
    },
    barnum: result.barnum || [],
    meta: {
      ts: new Date().toISOString(), ua: navigator.userAgent,
      liffId: typeof LIFF_ID!=='undefined'?LIFF_ID:null, app:'c-lab-liff', v:'2025-09'
    },
    client_v: 'web-2025-09'
  };

  const res = await fetch('/api/answer', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload),
    credentials:'same-origin',
    mode:'cors'
  });

  let json={}; try{ json = await res.json(); }catch(_){}
  if(!res.ok){
    console.error('POST /api/answer failed:', res.status, json);
    throw new Error(`HTTP ${res.status}: ${json?.error||'unknown error'}`);
  }
  console.log('POST /api/answer ok:', json);
}

// ---------- 共有 ----------
function getResultTitle(){
  return ($('#result-content .ttl')?.textContent||'').replace('【タイプ】','').trim() || '診断結果';
}

async function fetchImageAsFile(){
  const res = await fetch(SHARE_IMAGE_URL, { cache:'no-store' });
  const blob = await res.blob();
  return new File([blob], 'c_lab_share.png', { type: blob.type || 'image/png' });
}

async function shareOnLINE(){
  const imgUrl = SHARE_IMAGE_URL;
  const text   = CAPTION_LINE(getResultTitle());

  if(typeof liff==='undefined' || !liff.isInClient()){
    try{ await navigator.clipboard.writeText(text); }catch(_){}
    alert('LINEアプリで開くと、画像と文面をそのまま送れます。');
    location.href = LIFF_URL;
    return;
  }
  try{
    if(!liff.isApiAvailable('shareTargetPicker')) throw new Error('shareTargetPicker unavailable');
    await liff.shareTargetPicker([
      { type:'text',  text },
      { type:'image', originalContentUrl: imgUrl, previewImageUrl: imgUrl }
    ]);
  }catch(e){
    console.warn('shareTargetPicker error -> fallback', e);
    try{
      await liff.shareTargetPicker([{ type:'image', originalContentUrl: imgUrl, previewImageUrl: imgUrl }]);
      try{ await navigator.clipboard.writeText(text); }catch(_){}
      alert('画像だけ送ります。本文はコピー済みです。');
    }catch(e2){
      try{ await navigator.clipboard.writeText(text); }catch(_){}
      alert('共有に失敗しました。本文を貼り付け、画像を添付して送ってください。');
    }
  }
}

async function shareOtherApps(){
  const caption = CAPTION_OTHERS(getResultTitle());
  try{
    const file = await fetchImageAsFile();
    if(navigator.canShare?.({ files:[file] })){
      await navigator.share({ files:[file], text: caption, title:'C Lab' });
      return;
    }
  }catch(_){}
  try{ await navigator.clipboard.writeText(caption); }catch(_){}
  window.open(SHARE_IMAGE_URL, '_blank');
  alert('画像を開きました。本文はコピー済みです。お好みのアプリで貼り付けてください。');
}

// ---------- 進捗 ----------
function updateProgress(){
  const bar = $('#progress'); if(!bar) return;
  const ans = collectAnswers();
  const required = ['gender','age','q1','q2','q4','q5','q6','q7','q8'];
  const done = required.filter(k=>ans[k]).length + (ans.q3.length?1:0);
  const total = required.length + 1;
  const pct = Math.round((done/total)*100);
  bar.style.width = `${pct}%`;
}

// ---------- 起動 ----------
document.addEventListener('DOMContentLoaded', ()=>{
  ['#personalityForm','#run','#status','#progress','#result','#result-modal'].forEach(sel=>{
    console.log('DOM check:', sel, !!$(sel) ? 'OK' : 'NOT FOUND');
  });

  ['mot1','mot2','mot3'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){
      el.addEventListener('change', ()=>{ syncMotivationHidden(); updateProgress(); });
    }
  });
  ['#gender','#age','input[name="q1"]','input[name="q2"]','input[name="q4"]','input[name="q5"]','input[name="q6"]','input[name="q7"]','input[name="q8"]']
    .forEach(sel=> $$(sel).forEach(el=> el.addEventListener('change', updateProgress)));

  syncMotivationHidden(); updateProgress();

  const modal = $('#result-modal');
  const closeBtn = $('#close-modal');
  if(closeBtn) closeBtn.addEventListener('click', hideResultModal);
  if(modal){
    modal.addEventListener('click', (e)=>{ if(e.target===modal) hideResultModal(); });
  }
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && modal?.classList.contains('show')) hideResultModal(); });

  if(typeof window.liff!=='undefined'){
    initLIFF().catch(e=>{
      console.error('LIFF init failed:', e);
      const dummy = { userId:'liff-failed-'+Date.now(), displayName:'LIFFユーザー', pictureUrl:null };
      window.dummyProfile = dummy;
      setupFormHandlers(dummy);
      if($('#status')) $('#status').textContent='ブラウザモード（LINEアプリでの利用を推奨）';
    });
  }else{
    if($('#status')) $('#status').textContent='ブラウザモード（LIFF SDK未読込）';
    const dummy = { userId:'browser-user-'+Date.now(), displayName:'ブラウザユーザー', pictureUrl:null };
    window.dummyProfile = dummy;
    setupFormHandlers(dummy);
    console.warn('LIFF SDK not loaded - running in browser mode');
  }
});
