import { Client } from '@line/bot-sdk';
const client = new Client({ channelAccessToken: process.env.LINE_ACCESS_TOKEN });
export default async function handler(req,res){
  if (req.method!=='POST') return res.status(405).end();
  const { to, text } = req.body || {};
  if (!to || !text) return res.status(400).json({ error:'need to & text' });
  await client.pushMessage(to, { type:'text', text });
  res.status(200).json({ ok:true });
}
