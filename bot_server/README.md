# Co-Sync6 診断サーバー

Vercel Serverless Functions 上で動作する LINE 連携診断ワークフローです。25問の質問に回答すると Co-Sync6 の 6 因子を採点し、4 クラスタ／16 偉人にマッピングした結果を LINE Flex Message として返却します。

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. 環境変数を設定（Vercel Dashboard または `.env`）

| 変数 | 用途 |
| --- | --- |
| `LINE_CHANNEL_SECRET` | LINE Messaging API 署名検証 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API 応答 |
| `SUPABASE_URL` | Supabase プロジェクト URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー |
| `APP_BASE_URL` | シェアリンク等で使用する基底 URL |
| `LIFF_ID` | 診断開始用 LIFF アプリ ID |

3. Supabase スキーマを作成

```sql
\i db/schema.sql
```

4. 質問セットはリポジトリ管理

   - `data/questions.v1.js` と `lib/questions/index.js` が `/api/diagnosis` で配信する 25 問の唯一のソースです。Supabase 側にテーブルを用意する必要はありません（管理用途で同期する場合は `scripts/check-questions-consistency.ts` を利用できます）。

5. Vercel にデプロイし、`/line/webhook` を LINE Developers Console の Webhook URL に設定します。

## エンドポイント

- `POST /line/webhook` – LINE 署名検証・セッション払い出し
- `GET /api/diagnosis` – 質問リスト（`?v=1` でバージョン指定）
- `POST /api/diagnosis/submit` – 回答受領・採点・保存
- `GET /share/:session_id` – シェアカード HTML（`vercel.json` の rewrite 経由）
- `GET /diagnosis` – Web UI（`/api/diagnosis-ui` で HTML を返却）

### サンプル

#### `GET /api/diagnosis`

```json
{
  "version": 1,
  "count": 25,
  "questions": [
    {
      "code": "Q1",
      "text": "授業でグループ発表の役割を決めるとき、どう動く？",
      "choices": [
        { "key": "A", "label": "みんなの前でサッと手を挙げて進める" },
        { "key": "B", "label": "裏で進行表を作って迷わないよう整える" },
        { "key": "C", "label": "じっくり考えて自分に合う役割を静かに選ぶ" }
      ]
    }
  ]
}
```

#### `POST /api/diagnosis/submit`

リクエスト

```json
{
  "userId": "Uxxxxxxxx",
  "sessionId": null,
  "version": 1,
  "answers": [
    { "code": "Q1", "key": "A" },
    { "code": "Q2", "key": "A" },
    { "code": "Q3", "key": "A" }
    // ... 省略（計25問）
  ]
}
```

レスポンス

```json
{
  "ok": true,
  "sessionId": "session-123",
  "cluster": "challenge",
  "heroSlug": "oda",
  "imageUrl": "https://example.com/image.png",
  "factorScores": {
    "mbti": 0,
    "safety": 19,
    "workstyle": 11,
    "motivation": 15,
    "ng": 6,
    "sync": 15,
    "total": 66
  },
  "total": 66,
  "result": {
    "version": 1,
    "cluster": "challenge",
    "heroSlug": "oda",
    "factorScores": {
      "mbti": 0,
      "safety": 19,
      "workstyle": 11,
      "motivation": 15,
      "ng": 6,
      "sync": 15,
      "total": 66
    },
    "total": 66
  }
}
```

## テスト

Node.js 18 以降で標準テストランナーを使用します。

```bash
npm test
```

## 実装メモ

- 採点ロジック／クラスタ判定は `lib/scoring.js` に実装
- Supabase 永続化は `lib/persistence.js`
- Flex Message ビルダーは `lib/line.js`
- 16 偉人のベクターテストと乱数分布テストは `tests` ディレクトリ参照

## ライセンス

社内利用を想定したテンプレートです。
