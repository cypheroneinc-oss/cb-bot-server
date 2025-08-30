export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end(); // GET 以外は 405
  return res.status(200).json({ ok: true, time: new Date().toISOString() });
}
