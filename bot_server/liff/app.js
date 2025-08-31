// ===== 設定：あなたの LIFF ID を入れる =====
const LIFF_ID = '2008019437-Jxwm33XM';

// ===== ラベル（本文はここを直せばUIに反映） =====
const Q = [
  { key:'q1', title:'1. 仕事の進め方のスタンス\nQ: 何かに取りかかるとき、近いのは？', A:'とりあえず始めて、やりながら直す', B:'まず全体を整理してから始める' },
  { key:'q2', title:'2. 判断の決め手\nQ: 悩んだとき、より大事にするのは？', A:'なんとなくの直感やフィーリング', B:'理由やデータなどの根拠' },
  { key:'q4', title:'4. 苦手な環境\nQ: どちらの方がイヤ？', A:'ずっと細かく指示される', B:'ほったらかしで丸投げされる' },
  { key:'q5', title:'5. 感情の出し方\nQ: 気持ちが盛り上がったとき、近いのは？', A:'顔や言葉にすぐ出る', B:'外には出ないけど心の中で燃える' },
  { key:'q6', title:'6. 安心できるチーム\nQ: 一緒にいてラクなのは？', A:'何でもハッキリ言えるチーム', B:'空気を大事にして、和やかなチーム' },
  { key:'q7', title:'7. チームでの役割\nQ: 自然に多いのは？', A:'みんなを引っ張るリーダー役', B:'サポートして支える役' },
  { key:'q8', title:'8. 働き方の理想\nQ: 理想に近いのは？', A:'一つのことをじっくり極める', B:'いろんなことに同時にチャレンジする' },
];

const MOTIV_OPTIONS = [
  '成果を出したとき（達成感）',
  '認められたり褒められたとき（承認）',
  '誰かの役に立ったとき（貢献）',
  '安心できる環境があるとき（安心）',
  '新しいことを知れたとき（探究）',
  '自分のやり方で自由にできるとき（自由）',
  '仲間と一緒に動けるとき（仲間）',
  '成長している実感があるとき（成長）',
];

const $ = (s) => document.querySelector(s);
const el = (t,a={},h='') => {const n=document.createElement(t);Object.entries(a).forEach(([k,v])=>n.setAttribute(k,v));if(h)n.innerHTML=h;return n;};

function populateAge(){ const s=$('#age'); for(let a=12;a<=35;a++){const o=el('option',{value:String(a)},String(a)); s.appendChild(o);} }
function populateMotivationSelects(){
  ['m1','m2','m3'].forEach(id=>{
    const s=$('#'+id);
    MOTIV_OPTIONS.forEach(m=>s.appendChild(el('option',{value:m},m)));
  });
  const sync=()=>{
    const vals=['m1','m2','m3'].map(i=>$('#'+i).value);
    ['m1','m2','m3'].forEach(i=>{
      const sel=$('#'+i);
      [...sel.options].forEach(opt=>{
        if(!opt.value)return;
        opt.disabled = (vals.includes(opt.value) && sel.value!==opt.value);
      });
    });
  };
  ['m1','m2','m3'].forEach(id=>$('#'+id).addEventListener('change',sync));
}

function renderABQuestions(){
  const wrap=$('#qwrap'); wrap.innerHTML='';
  Q.forEach(q=>{
    const sec=el('section');
    sec.append(el('div',{class:'muted'},q.title.replace(/\n/g,'<br>')));
    const idA=`${q.key}-a`, idB=`${q.key}-b`;
    const la=el('label',{class:'opt',for:idA});
    la.append(el('input',{type:'radio',name:q.key,id:idA,value:'A',required:true}));
    la.append(document.createTextNode(`A. ${q.A}`));
    const lb=el('label',{class:'opt',for:idB});
    lb.append(el('input',{type:'radio',name:q.key,id:idB,value:'B',required:true}));
    lb.append(document.createTextNode(`B. ${q.B}`));
    sec.append(la,lb); wrap.append(sec);
  });
}

function collectAnswers(){
  const get=(k)=> (document.querySelector(`input[name="${k}"]:checked`)||{}).value || null;
  const motivations=['m1','m2','m3'].map(id=>$('#'+id).value).filter(Boolean);
  return { q1:get('q1'), q2:get('q2'), q3:motivations, q4:get('q4'), q5:get('q5'), q6:get('q6'), q7:get('q7'), q8:get('q8') };
}

// ===== 診断ロジック（絵文字つき） =====
function scoreAndExplain(ans){
  const keys=['q1','q2','q4','q5','q6','q7','q8']; let a=0,b=0; keys.forEach(k=>ans[k]==='A'?a++:b++);
  let type, emoji;
  if(a>b){ type='チャレンジ先行タイプ'; emoji='💪'; }
  else if(a<b){ type='計画ていねいタイプ'; emoji='🧩'; }
  else { type='バランスよしタイプ'; emoji='⚖️'; }
  const why =
    type==='チャレンジ先行タイプ' ? '思い立ったらすぐ動ける。まずやってみて、直しながら前へ進むのが得意。' :
    type==='計画ていねいタイプ' ? '準備や段取りを大切にできる。じっくり考えて、ムダなく進めるのが得意。' :
    '直感も計画もどちらも使える。状況に合わせて切り替えられるのが強み。';
  const fit =
    type==='チャレンジ先行タイプ' ? 'スピード感のある現場／小さく試して改善していく働き方' :
    type==='計画ていねいタイプ' ? '要件整理や計画・検証が大事な働き方／丁寧なコミュニケーション' :
    '状況に応じて実行も調整もできる役回り';
  const jobs =
    type==='チャレンジ先行タイプ' ? '企画、セールス、PdM、成長フェーズのスタートアップ' :
    type==='計画ていねいタイプ' ? 'バックオフィス、品質保証、データ分析、ドキュメンテーション' :
    'カスタマーサクセス、進行管理、コンサル、コーディネーター';
  const top=ans.q3?.[0]||'';
  const advBase =
    type==='チャレンジ先行タイプ' ? '走り出しは強み。あとで「なぜそうしたか」を一言メモに残すと説得力UP。' :
    type==='計画ていねいタイプ' ? '最初の一歩が重くなりがち。小さく始めて早めにフィードバックをもらうと◎。' :
    '得意なほうに寄りすぎないよう、意識してもう一方の視点も使おう。';
  const motivTips = top.includes('承認')?'ほめ合える場を自分から作ると火力が上がる。':
                    top.includes('自由')?'ゴールだけ決めて進め方は裁量大きめが合う。':
                    top.includes('仲間')?'1人作業にもチェックポイントでチームを絡めると◎。':
                    top.includes('成長')?'「前回より何が伸びたか」をメモすると継続しやすい。':
                    top.includes('安心')?'最初に合意形成と役割分担を決めるとその後が速い。':
                    top.includes('探究')?'時間を区切って探索→共有→次の仮説、のリズムを作ろう。':
                    top.includes('貢献')?'誰の何が良くなるかを明確にすると集中できる。':
                    top.includes('達成')?'小さなゴールを細かく刻むと達成感が積み上がる。':'';
  const adv = motivTips ? `${advBase} ${motivTips}` : advBase;
  return { type:`${type}${emoji}`, typeRaw:type, why, fit, jobs, adv };
}

function barnumComments(ans, typeRaw){
  const picks=[]; const first=ans.q3?.[0], second=ans.q3?.[1], third=ans.q3?.[2];
  const pushIf=(c,t)=>{ if(c && !picks.includes(t)) picks.push(t); };
  pushIf(first?.includes('承認'),'がんばりを見てくれる人がいると、実力が一気に出るタイプ。');
  pushIf(first?.includes('自由'),'自由度があると集中できるけど、締切があるとさらに加速する。');
  pushIf(first?.includes('仲間'),'一人でも進められるけど、仲間と動くとやる気が長続きする。');
  pushIf(first?.includes('成長'),'昨日より成長できた実感があると、次も自然と動ける。');
  pushIf(first?.includes('安心'),'土台が安心だと、新しい挑戦にも踏み出しやすい。');
  pushIf(first?.includes('探究'),'答えが出るまで深掘りしたくなる探究心がある。');
  pushIf(first?.includes('貢献'),'「誰かの役に立てた」がスイッチになりやすい。');
  pushIf(first?.includes('達成'),'小さな達成でも積み重ねるほど自信がつく。');
  if(second && picks.length<3) picks.push('状況を見て自分の役割を変えられる柔らかさがある。');
  if(third  && picks.length<3) picks.push('忙しい時ほど、やることをうまく絞れる。');
  if(picks.length<3){
    picks.push(
      typeRaw==='チャレンジ先行タイプ'?'思い切りがある一方で、ちゃんと慎重に考える場面もある。':
      typeRaw==='計画ていねいタイプ'?'準備は大事。でも動き出すと決めたら意外と行動が速い。':
      '状況を見て、直感と計画をうまく切り替えられる。'
    );
  }
  return picks.slice(0,3);
}

// ===== 共有テキスト生成 =====
function buildShareText(payload){
  const { result, answers, demographics } = payload;
  const motiv = (answers.q3||[]).map((x,i)=>`${i+1}位:${x}`).join(' / ') || '（未選択）';
  const link = `https://liff.line.me/${LIFF_ID}`;
  return `#Cbyme かんたん診断\nタイプ：${result.type}\n合う働き方：${result.fit}\n職種例：${result.jobs}\nやる気スイッチ：${motiv}\nやってみる→ ${link}`;
}

// ===== シェア実行 =====
async function shareToLine(text){
  try{
    if(liff.isApiAvailable('shareTargetPicker')){
      await liff.shareTargetPicker([{type:'text', text}], { isMultiple:true });
    }else{
      await liff.sendMessages([{type:'text', text}]);
    }
    alert('LINEにシェアしました！');
  }catch(e){ console.error(e); alert('LINEシェアに失敗しました'); }
}
async function shareNative(text){
  const url = `https://liff.line.me/${LIFF_ID}`;
  if(navigator.share){
    try{ await navigator.share({ text, url }); }
    catch(e){ if(e && e.name!=='AbortError') alert('共有に失敗しました'); }
  }else{
    await navigator.clipboard.writeText(`${text}\n${url}`);
    alert('共有テキストをコピーしました。アプリに貼り付けて投稿してください。');
  }
}
function shareToX(text){
  const url = `https://liff.line.me/${LIFF_ID}`;
  const u = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(u,'_blank');
}
function shareToThreads(text){
  // 非公式のIntent。使えない端末はコピーを案内。
  const url = `https://liff.line.me/${LIFF_ID}`;
  const u = `https://www.threads.net/intent/post?text=${encodeURIComponent(text+'\n'+url)}`;
  window.open(u,'_blank');
}
async function copyShare(text){
  const url = `https://liff.line.me/${LIFF_ID}`;
  await navigator.clipboard.writeText(`${text}\n${url}`);
  alert('診断テキストをコピーしました！');
}

// ===== LIFF 初期化 =====
async function init(){
  $('#status').textContent='LIFF 初期化中…';
  await liff.init({ liffId: LIFF_ID });
  if(!liff.isLoggedIn()){ $('#status').textContent='ログインへリダイレクトします…'; return liff.login(); }

  const prof = await liff.getProfile();
  const idt  = liff.getDecodedIDToken();
  $('#status').innerHTML = `ようこそ <b>${prof.displayName}</b> さん！ <span class="pill">${liff.isInClient()?'トーク内':'外部ブラウザ'}</span>`;

  populateAge(); populateMotivationSelects(); renderABQuestions();

  $('#form').addEventListener('submit', async (e)=>{
    e.preventDefault(); $('#submit').disabled=true;

    if(!$('#gender').value || !$('#age').value){ alert('年齢と性別を選んでください'); $('#submit').disabled=false; return; }
    const ans = collectAnswers();
    const missing=['q1','q2','q4','q5','q6','q7','q8'].filter(k=>!ans[k]);
    if(missing.length){ alert('未回答の質問があります'); $('#submit').disabled=false; return; }

    const demographics = { gender:$('#gender').value, age:$('#age').value, mbti:$('#mbti').value||'' };
    const result = scoreAndExplain(ans);
    const barnums = barnumComments(ans, result.typeRaw);

    try{
      const payload = {
        line:{ userId:prof.userId, displayName:prof.displayName, pictureUrl:prof.pictureUrl||null, email:idt?.email||null, inClient:liff.isInClient(), lang:liff.getLanguage() },
        demographics, answers:ans, result, barnum:barnums,
        meta:{ ts:new Date().toISOString(), ua:navigator.userAgent, v:'liff-v3-share' }
      };
      const res = await fetch('/api/answer',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });

      // 結果描画
      $('#r-type').textContent = result.type;
      $('#r-why').textContent  = result.why;
      $('#r-fit').textContent  = result.fit;
      $('#r-jobs').textContent = result.jobs;
      const motivText = (ans.q3||[]).map((x,i)=>`${i+1}位：${x}`).join(' / ') || '（未選択）';
      $('#r-motiv').textContent = motivText;
      $('#r-adv').textContent   = result.adv;
      $('#r-barnum').innerHTML  = barnums.map(t=>`<li>${t}</li>`).join('');
      $('#r-meta').textContent  = `送信: ${res.ok?'成功':'失敗'} / 年齢:${demographics.age} / 性別:${demographics.gender} / MBTI:${demographics.mbti||'-'}`;
      $('#resultCard').style.display='block';

      // シェア準備
      const shareText = buildShareText({ result, answers:ans, demographics });
      $('#shareCard').style.display='block';
      $('#share-line').onclick    = ()=>shareToLine(shareText);
      $('#share-native').onclick  = ()=>shareNative(shareText);
      $('#share-x').onclick       = ()=>shareToX(shareText);
      $('#share-threads').onclick = ()=>shareToThreads(shareText);
      $('#share-copy').onclick    = ()=>copyShare(shareText);

      // トーク内なら自分に結果を送っておく（従来挙動）
      if(liff.isInClient()){
        try{
          await liff.sendMessages([{ type:'text', text:`診断結果：${result.type}\nやる気スイッチ：${motivText}\n合う働き方：${result.fit}\n職種例：${result.jobs}` }]);
        }catch(_){}
      }
    }catch(err){
      console.error(err); alert('送信に失敗しました。電波状況をご確認ください。');
    }finally{
      $('#submit').disabled=false;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
