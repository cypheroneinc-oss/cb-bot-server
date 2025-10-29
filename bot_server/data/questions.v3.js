// /data/questions.v3.js
// 30問・Likert 6件法（UIは6=とてもそう思う〜1=まったくそう思わない）
// サーバ側では POS/NEG の二値へマップされます。
// v3: HEXACO(6)＋Balance(3) の各因子に対応。

const CHOICES = Object.freeze([
  { key: 'POS', label: 'YES' },
  { key: 'NEG', label: 'NO'  },
]);

// 共通設定：scale方向とchoices
const BASE = {
  choices: CHOICES,
  scale: { min: 1, max: 6, positiveDirection: 'left' },
};

const make = (id, text, extra = {}) =>
  Object.freeze({ id, code: id, text, ...BASE, ...extra });

// --------------------------------------------------

export default [
  make('Q01', '結果を出しても、自分からアピールしないタイプだ。', { axis: 'Trait', subfactor: 'E', tags: { reverse: true } }),          // Extraversion（低）
  make('Q02', '家族や友人の優しさとか、言葉で涙が出たことがある。', { axis: 'Trait', subfactor: 'A' }),                                    // Agreeableness
  make('Q03', '初めての人や場所でも、すぐ馴染める。',                   { axis: 'Trait', subfactor: 'E' }),                                    // Extraversion
  make('Q04', '一回決めたことは、最後までやりきる。',                     { axis: 'Trait', subfactor: 'C' }),                                    // Conscientiousness
  make('Q05', '相手の気持ちを1番に考えて話す方だ。',                       { axis: 'Trait', subfactor: 'A' }),                                    // Agreeableness
  make('Q06', '新しいやり方を見るとワクワクする。',                       { axis: 'Trait', subfactor: 'O' }),                                    // Openness
  make('Q07', '周りの意見より、自分の中の“正しさ”で動く方だ。',             { axis: 'Trait', subfactor: 'H' }),                                    // Honesty-Humility
  make('Q08', '目標を立てて、達成すると気持ちいい。',                     { axis: 'Trait', subfactor: 'C' }),                                    // Conscientiousness
  make('Q09', '落ち着いた環境のほうが力を出せる。',                       { axis: 'Trait', subfactor: 'N', tags: { reverse: true } }),           // Emotionality(逆)
  make('Q10', '誰かの役に立てると嬉しい。',                               { axis: 'Trait', subfactor: 'A' }),                                    // Agreeableness
  make('Q11', '平凡より変化がある方が気分が上がる。',                     { axis: 'Trait', subfactor: 'O' }),                                    // Openness
  make('Q12', 'リーダーっぽい立場になると燃える。',                       { axis: 'Trait', subfactor: 'E' }),                                    // Extraversion
  make('Q13', '「やる！」と自分で決めた瞬間、スイッチが入る。',             { axis: 'Balance', factor: 'action' }),                                // Do_it
  make('Q14', '得意なことを任されると集中できる。',                       { axis: 'Balance', factor: 'emotion' }),                               // Feel
  make('Q15', '「ありがとう」と言われるとまた頑張れる。',                 { axis: 'Balance', factor: 'emotion' }),                               // Feel
  make('Q16', '不安なことがないと、集中力が上がる。',                     { axis: 'Trait', subfactor: 'N', tags: { reverse: true } }),           // Emotionality(逆)
  make('Q17', '新しいことに誘われると、すぐワクワクする。',               { axis: 'Trait', subfactor: 'O' }),                                    // Openness
  make('Q18', '行動する前に、失敗しない方法を考える。',                   { axis: 'Balance', factor: 'speech' }),                                // Say(計画)
  make('Q19', '思いついたアイデアをメモしたり、形にしたくなる。',         { axis: 'Trait', subfactor: 'O' }),                                    // Openness
  make('Q20', '誰かのために動ける自分が好き。',                           { axis: 'Trait', subfactor: 'A' }),                                    // Agreeableness
  make('Q21', 'みんなが迷ってたら、ついまとめたくなる。',                 { axis: 'Balance', factor: 'speech' }),                                // Say
  make('Q22', '「なんでそうなるんだろ？」って考えるのが好き。',             { axis: 'Trait', subfactor: 'O' }),                                    // Openness
  make('Q23', '手を動かして何かを作るのが楽しい。',                       { axis: 'Balance', factor: 'action' }),                                // Do_it
  make('Q24', '進める手順が決まってると安心する。',                       { axis: 'Trait', subfactor: 'C' }),                                    // Conscientiousness
  make('Q25', 'むずかしいことがあっても、前に出て頑張りたい。',             { axis: 'Trait', subfactor: 'E' }),                                    // Extraversion
  make('Q26', '意味のないルールなら、変えちゃってもいいと思う。',         { axis: 'Trait', subfactor: 'O' }),                                    // Openness
  make('Q27', 'とりあえず動いて、やりながら答えを見つけたい。',           { axis: 'Balance', factor: 'action' }),                                // Do_it
  make('Q28', 'どんな質問にも「そう思う」ってなる人はいないと思う。',       { axis: 'Trait', subfactor: 'H', tags: { reverse: true } }),          // Honesty-Humility(逆)
  make('Q29', 'できれば失敗したくない。',                                 { axis: 'Trait', subfactor: 'N' }),                                    // Emotionality
  make('Q30', '流れに任せたほうがうまくいくこともある。',                 { axis: 'Balance', factor: 'emotion', tags: { reverse: true } }),      // Feel(逆)
];