import { getSupabaseAdmin } from '../../lib/supabase.js';
import {
  getClusterLabel,
  getClusterNarrative,
  getHeroProfile,
} from '../../lib/result-content.js';

function resolveBaseUrl() {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const prefixed = vercel.startsWith('http') ? vercel : `https://${vercel}`;
    return prefixed.replace(/\/$/, '');
  }
  const fallback = process.env.BASE_URL?.trim();
  if (fallback) {
    return fallback.replace(/\/$/, '');
  }
  return 'https://example.com';
}

function buildHtml({
  sessionId,
  headline,
  description,
  imageUrl,
  shareUrl,
  clusterLabel,
  heroName,
}) {
  const safeImage = imageUrl ?? 'https://placehold.co/1200x630?text=Diagnosis';
  const safeHeadline = headline || '診断結果を準備中';
  const safeDescription = description || 'Co-Sync6診断で可視化されたあなたの働き方スタイル。';
  const safeUrl = shareUrl ?? '#';

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>${safeHeadline}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${safeDescription}" />
    <meta property="og:title" content="${safeHeadline}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        background: #0b0b0f;
        color: #f5f5f5;
        font-family: 'Noto Sans JP', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        max-width: 420px;
        width: 100%;
        border-radius: 20px;
        border: 1px solid rgba(0, 209, 255, 0.6);
        background: radial-gradient(circle at top, rgba(0, 209, 255, 0.15), transparent 60%),
          rgba(15, 20, 30, 0.92);
        padding: 32px;
        text-align: center;
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4);
      }
      .card img {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(0, 209, 255, 0.6);
        margin: 24px 0;
      }
      .badge {
        display: inline-flex;
        padding: 0.4rem 0.9rem;
        border-radius: 999px;
        border: 1px solid rgba(0, 209, 255, 0.8);
        font-size: 0.8rem;
        letter-spacing: 0.05em;
        margin-bottom: 1rem;
      }
      h1 {
        font-size: 1.6rem;
        margin: 0 0 12px;
      }
      p {
        margin: 0 0 12px;
        line-height: 1.6;
        color: rgba(245, 245, 245, 0.85);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">SESSION ${sessionId}</div>
      <h1>${safeHeadline}</h1>
      <p>${safeDescription}</p>
      <img src="${safeImage}" alt="${heroName ?? '診断結果'}" />
      <p>#${clusterLabel ?? '診断結果'} をシェアして仲間と共有しよう。</p>
    </div>
  </body>
</html>`;
}

export default async function handler(req, res) {
  const { session_id: sessionId } = req.query;
  const baseUrl = resolveBaseUrl();

  let clusterKey = null;
  let heroSlug = null;
  let heroName = null;
  let cardImageUrl = null;

  try {
    const client = getSupabaseAdmin();
    const { data, error } = await client
      .from('diagnosis_results')
      .select('cluster_key, hero_slug, hero_name, share_card_url')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!error && data) {
      clusterKey = data.cluster_key ?? null;
      heroSlug = data.hero_slug ?? null;
      heroName = data.hero_name ?? null;
      cardImageUrl = data.share_card_url ?? null;
    }
  } catch (error) {
    console.error('Share page error', error);
  }

  const heroProfile = getHeroProfile(heroSlug);
  const effectiveHeroName = heroName ?? heroProfile.name;
  const clusterLabel = getClusterLabel(clusterKey ?? heroProfile.cluster);
  const narrative = getClusterNarrative(clusterKey ?? heroProfile.cluster);
  const shareUrl = `${baseUrl}/share/${sessionId}`;
  const imageUrl = cardImageUrl ?? heroProfile.avatarUrl;
  const headline = `あなたは${effectiveHeroName}！`;
  const description = narrative.summary1line || 'Co-Sync6診断で可視化されたあなたの働き方スタイル。';

  const html = buildHtml({
    sessionId,
    headline,
    description,
    imageUrl,
    shareUrl,
    clusterLabel,
    heroName: effectiveHeroName,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
