<!-- これは JS ファイルです。拡張子は .js で保存 -->
<script>
// Q&A 定義（UI生成用）
window.QUESTIONS = [
  {
    id: "q1",
    title: "1. 仕事の進め方のスタンス",
    question: "何かに取りかかるとき、近いのは？",
    type: "AB",
    options: [
      { value: "A", label: "A. とりあえず始めて、やりながら直す" },
      { value: "B", label: "B. まず全体を整理してから始める" }
    ]
  },
  {
    id: "q2",
    title: "2. 判断の決め手",
    question: "悩んだとき、より大事にするのは？",
    type: "AB",
    options: [
      { value: "A", label: "A. なんとなくの直感やフィーリング" },
      { value: "B", label: "B. 理由やデータなどの根拠" }
    ]
  },
  {
    id: "q3",
    title: "3. やる気が出る理由（複数OK）",
    question: "「よし、がんばろう！」と思えるのは？（複数選んでOK）",
    type: "MULTI",
    options: [
      { value: "1", label: "① 成果を出したとき（達成感）" },
      { value: "2", label: "② 認められたり褒められたとき（承認）" },
      { value: "3", label: "③ 誰かの役に立ったとき（貢献）" },
      { value: "4", label: "④ 安心できる環境があるとき（安心）" },
      { value: "5", label: "⑤ 新しいことを知れたとき（探究）" },
      { value: "6", label: "⑥ 自分のやり方で自由にできるとき（自由）" },
      { value: "7", label: "⑦ 仲間と一緒に動けるとき（仲間）" },
      { value: "8", label: "⑧ 成長している実感があるとき（成長）" }
    ],
    min: 1
  },
  {
    id: "q4",
    title: "4. 苦手な環境",
    question: "どちらの方がイヤ？",
    type: "AB",
    options: [
      { value: "A", label: "A. ずっと細かく指示される" },
      { value: "B", label: "B. ほったらかしで丸投げされる" }
    ]
  },
  {
    id: "q5",
    title: "5. 感情の出し方",
    question: "気持ちが盛り上がったとき、近いのは？",
    type: "AB",
    options: [
      { value: "A", label: "A. 顔や言葉にすぐ出る" },
      { value: "B", label: "B. 外には出ないけど心の中で燃える" }
    ]
  },
  {
    id: "q6",
    title: "6. 安心できるチーム",
    question: "一緒にいてラクなのは？",
    type: "AB",
    options: [
      { value: "A", label: "A. 何でもハッキリ言えるチーム" },
      { value: "B", label: "B. 空気を大事にして、和やかなチーム" }
    ]
  },
  {
    id: "q7",
    title: "7. チームでの役割",
    question: "自然に多いのは？",
    type: "AB",
    options: [
      { value: "A", label: "A. みんなを引っ張るリーダー役" },
      { value: "B", label: "B. サポートして支える役" }
    ]
  },
  {
    id: "q8",
    title: "8. 働き方の理想",
    question: "理想に近いのは？",
    type: "AB",
    options: [
      { value: "A", label: "A. 一つのことをじっくり極める" },
      { value: "B", label: "B. いろんなことに同時にチャレンジする" }
    ]
  }
];
</script>
