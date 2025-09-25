import { QUESTION_VERSION } from '../lib/scoring.js';

const STYLE = `body{margin:0;background:#0b0b0f;color:#f6f6f8;font-family:'Noto Sans JP',sans-serif;}main{min-height:100vh;padding:2rem;max-width:960px;margin:0 auto;}h1{font-size:2rem;margin-bottom:1rem;}button{background:#00d1ff;color:#0b0b0f;border:none;padding:0.75rem 1.5rem;border-radius:999px;font-weight:bold;cursor:pointer;}button[disabled]{opacity:0.4;cursor:not-allowed;}fieldset{border:1px solid rgba(0,209,255,0.3);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;background:rgba(255,255,255,0.04);}legend{padding:0 0.5rem;color:#00d1ff;font-weight:bold;}label{display:block;padding:0.5rem 0;border-radius:12px;cursor:pointer;}input[type=radio]{margin-right:0.75rem;}label:hover{background:rgba(0,209,255,0.08);}#summary{border:1px solid rgba(0,209,255,0.4);padding:1.5rem;border-radius:16px;margin-top:2rem;background:rgba(0,0,0,0.6);}table{width:100%;border-collapse:collapse;margin-top:1rem;}th,td{text-align:left;padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.1);}a{color:#00d1ff;}`;

const SCRIPT = `const API_BASE = '';const version=${QUESTION_VERSION};async function fetchQuestions(){const res=await fetch(\`/api/diagnosis?v=${QUESTION_VERSION}\`);if(!res.ok)throw new Error('failed to load questions');const json=await res.json();return json.questions;}function renderQuestions(list){const container=document.getElementById('questions');container.innerHTML='';list.forEach((q)=>{const field=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=q.text;field.appendChild(legend);q.choices.forEach((choice)=>{const label=document.createElement('label');const input=document.createElement('input');input.type='radio';input.name=q.id;input.value=choice.key;label.appendChild(input);label.append(choice.label);field.appendChild(label);});container.appendChild(field);});}function collectAnswers(){const inputs=document.querySelectorAll('input[type=radio]:checked');if(inputs.length!==25){throw new Error('全25問に回答してください');}return Array.from(inputs).map((input)=>({questionId:input.name,choiceKey:input.value}));}function renderResult(result){const summary=document.getElementById('summary');summary.innerHTML='<h2>診断結果</h2>';const list=document.createElement('ul');list.innerHTML=\`<li>クラスタ: ${result.cluster}</li><li>偉人: ${result.heroSlug}</li><li>合計スコア: ${result.scores.total}</li>\`;summary.appendChild(list);const table=document.createElement('table');table.innerHTML='<thead><tr><th>因子</th><th>スコア</th></tr></thead>';const tbody=document.createElement('tbody');[['MBTI',result.scores.mbti],['心理的安全性',result.scores.safety],['ワークスタイル',result.scores.workstyle],['モチベーション',result.scores.motivation],['NGトリガー',result.scores.ng],['感情同期',result.scores.sync]].forEach(([label,value])=>{const row=document.createElement('tr');row.innerHTML=\`<td>${label}</td><td>${value}</td>\`;tbody.appendChild(row);});table.appendChild(tbody);summary.appendChild(table);const flex=JSON.stringify(result.flexMessage,null,2);const pre=document.createElement('pre');pre.textContent=flex;summary.appendChild(pre);summary.scrollIntoView({behavior:'smooth'});}async function handleSubmit(event){event.preventDefault();const sessionInput=document.getElementById('session');const sessionId=sessionInput.value.trim();if(!sessionId){alert('sessionIdを入力してください');return;}const button=document.getElementById('submit');button.disabled=true;button.textContent='送信中...';try{const answers=collectAnswers();const res=await fetch('/api/diagnosis/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,answers})});if(!res.ok){throw new Error('送信に失敗しました');}const json=await res.json();renderResult(json);}catch(error){alert(error.message);}finally{button.disabled=false;button.textContent='結果を送信';}}document.addEventListener('DOMContentLoaded',async()=>{document.getElementById('form').addEventListener('submit',handleSubmit);const questions=await fetchQuestions();renderQuestions(questions);});`;

export default function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Co-Sync6 診断</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>Co-Sync6 診断</h1>
<p>25問に回答してあなたの働き方スタイルを診断しましょう。LINEからのアクセスでセッションIDが払い出されます。</p>
<form id="form">
<label for="session">セッションID</label>
<input id="session" name="session" type="text" placeholder="LINEで発行された session_id" style="width:100%;padding:0.75rem;border-radius:12px;border:1px solid rgba(0,209,255,0.4);margin:0.5rem 0 1.5rem;background:rgba(255,255,255,0.08);color:#fff;" required />
<div id="questions"></div>
<button id="submit" type="submit">結果を送信</button>
</form>
<section id="summary"></section>
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
