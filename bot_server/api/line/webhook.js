import crypto from 'node:crypto';
import { QUESTION_VERSION } from '../../lib/scoring.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { verifyLineSignature } from '../../lib/line.js';

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function pushMessage(to, messages) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return;
  }
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ to, messages })
  });
}

async function replyMessage(replyToken, messages) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken || !replyToken) {
    return;
  }
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ replyToken, messages })
  });
}

async function createSession(userId) {
  const sessionId = crypto.randomUUID();
  const client = getSupabaseClient({ optional: true });
  if (!client) {
    return sessionId;
  }
  const { error } = await client
    .from('diagnostic_sessions')
    .insert({
      id: sessionId,
      user_id: userId,
      question_set_version: QUESTION_VERSION
    });
  if (error) {
    throw error;
  }
  return sessionId;
}

function buildStartMessage(sessionId) {
  const liffId = process.env.LIFF_ID;
  const baseUrl = process.env.APP_BASE_URL ?? 'https://example.com';
  const entryUrl = liffId
    ? `https://liff.line.me/${liffId}?session=${sessionId}`
    : `${baseUrl}/diagnosis?session=${sessionId}`;
  return [
    {
      type: 'text',
      text: '25問の診断であなたの働き方スタイルをチェックしましょう。',
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'uri',
              label: '診断をはじめる',
              uri: entryUrl
            }
          }
        ]
      }
    }
  ];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-line-signature'];
  if (!signature || !verifyLineSignature(rawBody, signature)) {
    res.status(401).end('Invalid signature');
    return;
  }

  try {
    const body = JSON.parse(rawBody);
    const events = body.events ?? [];

    for (const event of events) {
      const userId = event.source?.userId;
      if (!userId) {
        // skip non-user events
        continue;
      }

      if (event.type === 'follow') {
        const sessionId = await createSession(userId);
        await pushMessage(userId, buildStartMessage(sessionId));
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text ?? '';
        if (/診断|start|はじめる/i.test(text)) {
          const sessionId = await createSession(userId);
          await replyMessage(event.replyToken, buildStartMessage(sessionId));
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('LINE webhook error', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
