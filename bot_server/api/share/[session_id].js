import { getSupabaseAdmin } from '../../lib/supabase.js';

function renderHtml({ sessionId, cluster, heroSlug, imageUrl }) {
  const title = cluster && heroSlug ? `診断結果｜${cluster}｜${heroSlug}` : '診断結果を準備中';
  const description = 'Co-Sync6診断で可視化されたあなたの働き方スタイル。';
  const ogImage = imageUrl ?? 'https://placehold.co/1200x630?text=Share+Coming+Soon';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="${description}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:type" content="website" />
<style>
body { background:#0b0b0f; color:#f5f5f5; font-family:'Noto Sans JP',sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
.card { max-width:420px; border:1px solid #00d1ff; border-radius:16px; padding:32px; background:linear-gradient(135deg, rgba(0,0,0,0.95), rgba(0,80,120,0.6)); text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.3); }
.card img { width:100%; border-radius:12px; border:1px solid #00d1ff; margin:24px 0; }
.card h1 { font-size:1.6rem; margin-bottom:0.75rem; }
.card p { line-height:1.6; }
.badge { display:inline-flex; align-items:center; justify-content:center; padding:0.4rem 0.8rem; border-radius:999px; border:1px solid #00d1ff; margin-bottom:1rem; }
</style>
</head>
<body>
<div class="card">
<div class="badge">SESSION ${sessionId}</div>
<h1>${title}</h1>
<p>${description}</p>
<img src="${ogImage}" alt="${heroSlug ?? 'share image'}" />
<p>LINEからのアクセスで詳しい診断結果を確認できます。</p>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  const { session_id: sessionId } = req.query;
  let cluster = null;
  let heroSlug = null;
  let imageUrl = null;

  try {
    const client = getSupabaseAdmin();
    const { data, error } = await client
      .from('result_assignments')
      .select('cluster, hero_slug')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (!error && data) {
      cluster = data.cluster;
      heroSlug = data.hero_slug;
      const asset = await client
        .from('share_card_assets')
        .select('image_url')
        .eq('hero_slug', heroSlug)
        .maybeSingle();
      if (!asset.error) {
        imageUrl = asset.data?.image_url ?? null;
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Share page error', error);
  }

  const html = renderHtml({ sessionId, cluster, heroSlug, imageUrl });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
