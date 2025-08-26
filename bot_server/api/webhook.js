import { middleware, Client } from '@line/bot-sdk';
const config = { channelSecret: process.env.LINE_CHANNEL_SECRET, channelAccessToken: process.env.LINE_ACCESS_TOKEN };
const client = new Client(config);
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try { middleware(config)(req, res, ()=>{}); } catch { return res.status(401).end(); }
  const events = req.body.events || [];
  await Promise.all(events.map(async (ev) => {
    if (ev.type === 'follow') {
      const liffId = process.env.LIFF_ID;
      const uri = `https://liff.line.me/${liffId}`;
      await client.pushMessage(ev.source.userId, {
        type: 'text',
        text: '友だち追加ありがとう！60秒診断はこちら👇',
        quickReply: { items: [{ type: 'action', action: { type: 'uri', label: '診断を始める', uri } }] }
      });
    }
  }));
  return res.status(200).json({ ok: true });
}
