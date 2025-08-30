import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { userId, answers } = req.body;

  // 簡易ロジック（例：直感型 vs 論理型）
  let type = "バランスタイプ";
  let message = "自分らしく働ける道を探していこう！";

  if (answers[0] === "とりあえず始めて直す" && answers[1] === "直感・フィーリング") {
    type = "チャレンジャー";
    message = "動きながら学ぶタイプ！新しい挑戦や企画職が向いてるよ。";
  } else if (answers[0] === "整理してから始める" && answers[1] === "データや理由") {
    type = "プランナー";
    message = "しっかり準備して進めるタイプ！企画職や分析職にピッタリ。";
  }

  // Supabaseに保存
  await supabase.from("responses").insert([
    { user_id: userId, answers, result_type: type, result_message: message }
  ]);

  // ユーザーに返す
  res.status(200).json({ type, message });
}
