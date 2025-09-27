export const config = { runtime: 'nodejs' }; // なぜ: Node.js ランタイムで環境変数を確認したい為

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return res.status(200).json({
    ok: true,
    now: Date.now(),
    env: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'].map((k) => ({ k, present: !!process.env[k] })),
  });
}
