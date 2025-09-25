# Co-Sync6 診断サーバー

Vercel Serverless Functions 上で動作する LINE 連携診断ワークフローです。25問の質問に回答すると Co-Sync6 の 6 因子を採点し、4 クラスター／16 偉人にマッピングした結果を LINE Flex Message として返却します。

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

4. Vercel にデプロイし、`/line/webhook` を LINE Developers Console の Webhook URL に設定します。

## エンドポイント

- `POST /line/webhook` – LINE 署名検証・セッション払い出し
- `GET /diagnosis` – 質問リスト（`?v=1` でバージョン指定）
- `POST /diagnosis/submit` – 回答受領・採点・保存
- `GET /share/:session_id` – シェアカード HTML（`vercel.json` の rewrite 経由）
- `GET /diagnosis` – Web UI（`/api/diagnosis-ui` で HTML を返却）

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
