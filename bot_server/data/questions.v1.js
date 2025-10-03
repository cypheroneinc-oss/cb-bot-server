export default [
  // Q01–Q24: Likert 6段（左=YES／右=NO）
  // 共通仕様：choices = POS / NEG（mapLikertToChoiceがscale→choiceKeyに変換）
  { id: "Q01", text: "クラスや部活でトラブルが起きたら、自分が前に出てまとめたいと思う？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q02", text: "頑張ったのに力を出し切れなかったとき、すごく悔しい？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q03", text: "きっちり決まったやり方より、自分なりのやり方を試したくなる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q04", text: "「言われた通りにやれ」と強く言われると、反発したくなる気持ちが出る？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q05", text: "初めて行く場所や新しい遊びを見つけると、すぐ試したくなる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q06", text: "毎日同じことの繰り返しってつまらないと思う？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q07", text: "授業中やノートのすみに、アイデアや絵を描きたくなることある？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q08", text: "自分の作品や意見がみんなと同じだと、がっかりする？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q09", text: "わからないことがあると、調べて本当の理由を知りたくなる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q10", text: "思い込みで動いたり、間違ったことを広めるのは恐い？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q11", text: "工夫して、みんなが驚くような変化を起こしたい？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q12", text: "どれだけ頑張っても何も変わらない状況ってイヤ？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q13", text: "友達が落ち込んでたら、放っておけない？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q14", text: "助けたいのに何もできない状況ってつらい？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q15", text: "グループ活動のとき、自然と役割分担や進め方を考える方？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q16", text: "ルールや指示がなくてバラバラだと、不安になる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q17", text: "クラスや部活でみんなと一緒に過ごせると安心する？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q18", text: "自分だけ呼ばれなかったり浮くと気になる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q19", text: "空気が重いとき、冗談や一言で場を明るくしたくなる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q20", text: "退屈な時間が続くとイライラする？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q21", text: "大切にしたい人や物があると、自然とがんばれる？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q22", text: "自分の気持ちを無視されるのはつらい？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  { id: "Q23", text: "人や世界を信じたい、もっと良い世界があるって思う？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },
  { id: "Q24", text: "信じてたものに裏切られるとすごく落ち込む？",
    choices: [{ key: "POS", label: "YES" }, { key: "NEG", label: "NO" }] },

  // Q25–Q30: Gate（二択・A/B）
  // 共通仕様：choices = A / B（タイブレークと軽い加点に使用）
  { id: "Q25", text: "リーダーになるなら →",
    choices: [
      { key: "A", label: "前に出て引っ張る（Hero）" },
      { key: "B", label: "全体をまとめる（Ruler）" }
    ]},
  { id: "Q26", text: "楽しいのは →",
    choices: [
      { key: "A", label: "新しいことを試す（Explorer）" },
      { key: "B", label: "正しい答えを探す（Sage）" }
    ]},
  { id: "Q27", text: "近いのは →",
    choices: [
      { key: "A", label: "人と深くつながりたい（Lover）" },
      { key: "B", label: "人を支えたい（Caregiver）" }
    ]},
  { id: "Q28", text: "自分らしいのは →",
    choices: [
      { key: "A", label: "場を盛り上げたい（Jester）" },
      { key: "B", label: "みんなと同じ空気でいたい（Everyman）" }
    ]},
  { id: "Q29", text: "変えるなら →",
    choices: [
      { key: "A", label: "いらないものは壊す（Outlaw）" },
      { key: "B", label: "工夫して変化を起こす（Magician）" }
    ]},
  { id: "Q30", text: "ワクワクするのは →",
    choices: [
      { key: "A", label: "知識を集めて理解する（Sage）" },
      { key: "B", label: "形にして表現する（Creator）" }
    ]}
];
