export function scoreToType(answers){
  const { q1,q2,q3,q4,q5,q6,q7,q8 } = answers;
  let A=0,B=0,C=0,D=0;
  if (q5==='Intuition' || q1==='N') A++;
  if (['仲間','承認'].includes(q6)) A++;
  if (['明るい','まったり'].includes(q8)) A++;
  if (q5==='Logic' || q6==='成果' || q4==='Speed') B+=2;
  if (q2==='High' || q6==='安心' || q4==='Care') C+=2;
  if (['自由','探究'].includes(q6) || (q2==='Low' && q5==='Intuition')) D+=2;
  const scores = {A,B,C,D};
  return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
}
export function typeMessage(t){
  const map = {
    A: {title:'直感×なかまタイプ', body:'ひらめきをパッと形にできる。人と話しながら作るのが得意。', fit:'アイデアを出して形にする仕事／チームで動く場所'},
    B: {title:'論理×成果タイプ', body:'目標がハッキリしてるほど強い。数字や結果で勝負できる。', fit:'ゴールから考える仕事／成果が見える場所'},
    C: {title:'協調×あんしんタイプ', body:'人によりそうのが得意。まわりをサポートして力を引き出せる。', fit:'人を支える仕事／落ち着いて学べる場所'},
    D: {title:'自由×たんきゅうタイプ', body:'新しいことにワクワク。自分で試して道をつくれる。', fit:'新しいことに挑戦／やり方を作る場所'}
  };
  return map[t];
}
