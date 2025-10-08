// Cロジック診断 用 36問（6法同意）
// スケール: 1=まったくそう思わない … 6=とてもそう思う
// reverse=true の項目はスコアを (7 - 回答値) で反転

const QUESTIONS = [
  // ========== Trait（性格）10問 ==========
  { id: "T-E-01", axis: "Trait", subfactor: "Extraversion", reverse: false, text: "みんなの前に立つと、自然にスイッチが入る。" },
  { id: "T-E-02", axis: "Trait", subfactor: "Extraversion", reverse: true,  text: "一人の時間のほうが落ち着く。" },

  { id: "T-C-01", axis: "Trait", subfactor: "Conscientiousness", reverse: false, text: "予定を立てると安心して動けるタイプだ。" },
  { id: "T-C-02", axis: "Trait", subfactor: "Conscientiousness", reverse: true,  text: "その日の気分で動くことが多い。" },

  { id: "T-O-01", axis: "Trait", subfactor: "Openness", reverse: false, text: "「今までと違うやり方」にワクワクする。" },
  { id: "T-O-02", axis: "Trait", subfactor: "Openness", reverse: true,  text: "決まったやり方を変えるのはあまり得意じゃない。" },

  { id: "T-A-01", axis: "Trait", subfactor: "Agreeableness", reverse: false, text: "空気の変化に気づくと、ついフォローに回る。" },
  { id: "T-A-02", axis: "Trait", subfactor: "Agreeableness", reverse: true,  text: "自分の意見を通すほうが大事だ。" },

  { id: "T-N-01", axis: "Trait", subfactor: "Neuroticism", reverse: false, text: "ミスしたことを、頭の中で何度も思い返してしまう。" },
  { id: "T-N-02", axis: "Trait", subfactor: "Neuroticism", reverse: true,  text: "困難があっても、わりとすぐ切り替えられる。" },

  // ========== Value（価値観）6問 ==========
  { id: "V-AUT-01", axis: "Value", subfactor: "Autonomy", reverse: false, text: "周りよりも、自分の中の“正しさ”で動きたい。" },
  { id: "V-ACH-01", axis: "Value", subfactor: "Achievement", reverse: false, text: "目標があると、全力でそこに集中できる。" },
  { id: "V-SEC-01", axis: "Value", subfactor: "Security", reverse: false, text: "先の見える環境のほうが、落ち着いて力を出せる。" },
  { id: "V-UNI-01", axis: "Value", subfactor: "Universalism", reverse: false, text: "人の役に立てると、それだけで一日が報われる気がする。" },
  { id: "V-STI-01", axis: "Value", subfactor: "Stimulation", reverse: false, text: "変化があると、自然と気持ちが前に向く。" },
  { id: "V-POW-01", axis: "Value", subfactor: "Power", reverse: false, text: "流れを作ったり、方針を決める役にやりがいを感じる。" },

  // ========== Motivation（動機）4問 ==========
  { id: "M-AUT-01", axis: "Motivation", subfactor: "Autonomy", reverse: false, text: "やることを自分で決めた瞬間、やる気が出る。" },
  { id: "M-COM-01", axis: "Motivation", subfactor: "Competence", reverse: false, text: "「これは自分が得意だ」と思うと集中できる。" },
  { id: "M-REL-01", axis: "Motivation", subfactor: "Relatedness", reverse: false, text: "誰かに「助かった」と言われると、もう一歩頑張れる。" },
  { id: "M-SAF-01", axis: "Motivation", subfactor: "Safety", reverse: false, text: "余計な不安がないと、やることに集中できる。" },

  // ========== Orientation（志向）3問 ==========
  { id: "O-PRO-01", axis: "Orientation", subfactor: "Promotion", reverse: false, text: "やったことのないことに誘われると、ワクワクする。" },
  { id: "O-PRE-01", axis: "Orientation", subfactor: "Prevention", reverse: false, text: "うまくいくかどうかより、失敗しない方法を先に考える。" },
  { id: "O-PRO-02", axis: "Orientation", subfactor: "Promotion", reverse: false, text: "慎重さよりも、必要ならスピードを優先する。" },

  // ========== Interest（興味）8問 ==========
  { id: "I-ART-01", axis: "Interest", subfactor: "Artistic", reverse: false, text: "頭に浮かんだイメージを、形にしたくなる。" },
  { id: "I-SOC-01", axis: "Interest", subfactor: "Social", reverse: false, text: "誰かの役に立てる瞬間にやりがいを感じる。" },
  { id: "I-ENT-01", axis: "Interest", subfactor: "Enterprising", reverse: false, text: "みんなが迷っていると、自然に仕切ってしまう。" },
  { id: "I-INV-01", axis: "Interest", subfactor: "Investigative", reverse: false, text: "物事の「なぜ？」を考えるのがクセになっている。" },
  { id: "I-REA-01", axis: "Interest", subfactor: "Realistic", reverse: false, text: "手を動かして何かを完成させるのが気持ちいい。" },
  { id: "I-CON-01", axis: "Interest", subfactor: "Conventional", reverse: false, text: "手順がはっきりしているほうが落ち着く。" },
  { id: "I-ART-02", axis: "Interest", subfactor: "Artistic", reverse: true,  text: "形に残らない作業には、あまり興味が湧かない。" },
  { id: "I-SOC-02", axis: "Interest", subfactor: "Social", reverse: true,  text: "他人の問題に、できれば深入りしたくない。" },

  // ========== Fit（適合）5問 ==========
  { id: "F-SAFE-01", axis: "Fit", subfactor: "PsychSafety", reverse: false, text: "自分の意見を言っても、ちゃんと聞いてもらえるとホッとする。" },
  { id: "F-FLEX-01", axis: "Fit", subfactor: "Flexibility", reverse: false, text: "考え方が違う人とも、一緒にやってみようと思える。" },
  { id: "F-TRST-01", axis: "Fit", subfactor: "Trust", reverse: false, text: "信頼できる人がそばにいると、挑戦しやすい。" },
  { id: "F-COOP-01", axis: "Fit", subfactor: "Collaboration", reverse: false, text: "誰かと力を合わせると、普段より集中できる。" },
  { id: "F-FLEX-02", axis: "Fit", subfactor: "Flexibility", reverse: true,  text: "合わないと思えば、早めに距離を置くほうだ。" }
];

export default QUESTIONS;
