export default [
  // Q01–Q24: Likert 6段（左=YES／右=NO）
  // 共通仕様：choices = POS / NEG（mapLikertToChoiceがscale→choiceKeyに変換）
export default [
  { id: "Q01", text: "人が集まる場では、自分が中心になるより、周りを見て動く方が多い？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q02", text: "うまくいかなくても、『まあ次でいいか』と思えるタイプ？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q03", text: "新しい方法より、まずは今のやり方を理解してから動きたい？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q04", text: "決まりや指示があっても、自分の考えを曲げずに動くことがある？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q05", text: "知らない場所や初めての体験より、慣れた環境の方が落ち着く？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q06", text: "同じことの繰り返しでも、安心できる部分がある？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q07", text: "頭に浮かんだアイデアをすぐ形にせず、寝かせて考える方？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q08", text: "自分の考えがみんなと同じでも、それはそれで安心できる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q09", text: "答えが出ないことも、『そういうものか』と受け止められる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q10", text: "細かい根拠よりも、まず直感で動くことが多い？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q11", text: "目立つ変化より、じわじわと良くしていく方が好き？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q12", text: "変化が多すぎる環境より、一定のペースを保てる環境が向いてる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q13", text: "人が落ち込んでいても、相手のペースを尊重して見守る方？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q14", text: "困っている人がいても、自分ができる範囲を考えて動く？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q15", text: "グループでは、リーダーよりサポート側でいる方が落ち着く？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q16", text: "ルールがなくても、状況を見て柔軟に動ける方？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q17", text: "みんなで過ごすより、一人の時間でリセットしたくなる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q18", text: "みんなの輪に入りづらくても、無理に合わせようとは思わない？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q19", text: "誰かといてしーんとした時でも、気まずさをあまり感じない方？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q20", text: "退屈な時間があっても、心の整理やアイデア出しに使える方？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q21", text: "大切な人や物がなくても、自分のために頑張れる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q22", text: "自分の意見が通らなくても、『仕方ない』と切り替えられる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q23", text: "理想よりも、現実的にできることから考える方？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q24", text: "信じていたことが違っても、現実を受け止めて前に進める？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },


  // Q25–Q30: Gate（二択・A/B）
  // 共通仕様：choices = A / B（タイブレークと軽い加点に使用）
  { id: "Q25", text: "リーダーになるなら →",
    choices: [
      { key: "A", label: "みんなを前で引っ張る" },
      { key: "B", label: "バランス見て全体をまとめる" }
    ]},
  { id: "Q26", text: "楽しいのは →",
    choices: [
      { key: "A", label: "新しいことを試す" },
      { key: "B", label: "正しい答えを探す" }
    ]},
  { id: "Q27", text: "近いのは →",
    choices: [
      { key: "A", label: "人と深くつながりたい" },
      { key: "B", label: "人を支えたい" }
    ]},
  { id: "Q28", text: "自分らしいのは →",
    choices: [
      { key: "A", label: "場を盛り上げたい" },
      { key: "B", label: "みんなと同じ空気でいたい" }
    ]},
  { id: "Q29", text: "変えるなら →",
    choices: [
      { key: "A", label: "いらないものは壊す" },
      { key: "B", label: "工夫して変化を起こす" }
    ]},
  { id: "Q30", text: "ワクワクするのは →",
    choices: [
      { key: "A", label: "知識を集めて理解する" },
      { key: "B", label: "形にして表現する" }
    ]}
];
