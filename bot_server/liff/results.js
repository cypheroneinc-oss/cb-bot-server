<!-- これは JS ファイルです。拡張子は .js で保存 -->
<script>
(function () {
  const MOTIVATION_MAP = {
    "1": "ゴールを決めて走る派🏁",
    "2": "褒められて伸びる派👏",
    "3": "人の役に立ちたい派🤝",
    "4": "落ち着く環境大事派🏡",
    "5": "新しいことワクワク派🔍",
    "6": "マイペース型😎",
    "7": "みんなでワイワイ派🎉",
    "8": "昨日より進化したい派🌱"
  };

  function pickType(q1, q2) {
    if (q1 === "A" && q2 === "A") {
      return {
        key: "AA",
        title: "ひらめきチャレンジャー⚡️",
        desc: "思い立ったら動ける行動派。新しいことに強い！",
        jobs: ["営業", "事業開発", "イベント運営", "SNS/コミュニティ"]
      };
    }
    if (q1 === "A" && q2 === "B") {
      return {
        key: "AB",
        title: "ロジカルアタッカー📊",
        desc: "動きは早いけど考えも筋道立ってる。改善が得意！",
        jobs: ["マーケ運用", "PM/スクラム", "コンサル見習い", "インサイドセールス"]
      };
    }
    if (q1 === "B" && q2 === "A") {
      return {
        key: "BA",
        title: "アイデアプランナー💡",
        desc: "準備してから良いアイデアを出すタイプ。企画◎",
        jobs: ["商品/サービス企画", "デザイン/編集", "広報PR", "コンテンツ制作"]
      };
    }
    return {
      key: "BB",
      title: "カチッとプランナー📋",
      desc: "段取りと精度が強み。安心して任せられる！",
      jobs: ["経理/管理", "リサーチ/アナリスト", "品質/QA", "データ/バックエンド"]
    };
  }

  function readableAB(val, A, B) {
    return val === "A" ? A : B;
  }

  // 公開関数：診断結果を作る
  window.buildDiagnosis = function (answers) {
    const type = pickType(answers.q1, answers.q2);

    const result = {
      typeTitle: type.title,
      typeDesc: type.desc,
      style: readableAB(answers.q1, "動きながら考えるタイプ🚀", "ちゃんと準備してからやるタイプ📋"),
      decision: readableAB(answers.q2, "ひらめきセンサー型✨", "データで安心型📊"),
      motivation: (answers.q3 || []).map(v => MOTIVATION_MAP[v]).filter(Boolean),
      weakEnv: readableAB(answers.q4, "がんじがらめはイヤ🙅‍♀️", "ほったらかしはイヤ🙅‍♂️"),
      emotion: readableAB(answers.q5, "感情オープン型😆", "クールだけど熱い型🔥"),
      team: readableAB(answers.q6, "ズバズバチーム🗣", "ほっこりチーム☕️"),
      role: readableAB(answers.q7, "みんなを引っ張る先頭型👑", "みんなを支える縁の下型🛠"),
      ideal: readableAB(answers.q8, "職人スタイル🎨", "チャレンジャースタイル⚡️"),
      goodJobs: type.jobs,
      advice: (() => {
        const tips = [];
        if (answers.q1 === "A") tips.push("まず走って、途中で作戦会議！🏃‍♂️→🧭");
        if (answers.q1 === "B") tips.push("やりすぎな計画はNG。小さく試して学ぼう🧪");
        if (answers.q2 === "A") tips.push("ひらめきをメモして、あとで理由を足そう📝");
        if (answers.q2 === "B") tips.push("根拠集めに時間を使いすぎないように⏱");
        const topMot = (answers.q3 || [])[0];
        if (topMot === "7") tips.push("仲間と進めると最強。ペア作業や朝会を活用🤝");
        if (topMot === "6") tips.push("やる順番を自分で決められるタスク設計に😎");
        return tips;
      })()
    };
    return result;
  };
})();
</script>
