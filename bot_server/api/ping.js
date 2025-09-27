export const config = { runtime: 'nodejs' }; // なぜ: Node.js ランタイムで環境変数を確認したい為

const REQUIRED_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    env: REQUIRED_KEYS.map((k) => ({ k, present: Boolean(process.env[k]) })),
  });
}
