import crypto from 'node:crypto';

export function verifyLineSignature(body, signature) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    throw new Error('LINE channel secret is not configured');
  }
  const hmac = crypto.createHmac('sha256', channelSecret);
  hmac.update(body, 'utf8');
  const digest = hmac.digest('base64');
  return digest === signature;
}

export function buildFlexMessage({ heroSlug, cluster, imageUrl, displayName, sessionId }) {
  const baseUrl = process.env.APP_BASE_URL ?? 'https://example.com';
  const clusterLabelMap = {
    challenge: '挑戦型',
    creative: '創造型',
    support: '支援型',
    strategy: '戦略型'
  };

  const heroLabelMap = {
    oda: '織田信長',
    napoleon: 'ナポレオン',
    ryoma: '坂本龍馬',
    galileo: 'ガリレオ',
    davinci: 'レオナルド・ダ・ヴィンチ',
    picasso: 'ピカソ',
    beethoven: 'ベートーヴェン',
    murasaki: '紫式部',
    nightingale: 'ナイチンゲール',
    mother_teresa: 'マザー・テレサ',
    shibusawa: '渋沢栄一',
    rikyu: '千利休',
    ieyasu: '徳川家康',
    shotoku: '聖徳太子',
    date: '伊達政宗',
    einstein: 'アインシュタイン'
  };

  const placeholderImage = 'https://placehold.co/1024x1024?text=Coming+Soon';
  const heroName = heroLabelMap[heroSlug] ?? '未知の偉人';
  const clusterLabel = clusterLabelMap[cluster] ?? '未知のスタイル';

  const altText = `診断結果：あなたは${clusterLabel}｜${heroName}`;

  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: imageUrl ?? placeholderImage,
        size: 'full',
        aspectRatio: '1:1',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: displayName ?? 'あなたの働き方スタイル',
            weight: 'bold',
            size: 'sm'
          },
          {
            type: 'text',
            text: `${clusterLabel}｜${heroName}`,
            weight: 'bold',
            size: 'xl',
            wrap: true
          },
          {
            type: 'text',
            text: '診断結果をシェアして仲間と共感しよう。',
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'uri',
              label: '結果を保存・シェア',
              uri: `${baseUrl}/share/${sessionId}`
            }
          }
        ]
      }
    }
  };
}
