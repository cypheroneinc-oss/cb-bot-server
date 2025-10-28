// /lib/industry.v3.js
// 業界24カテゴリ（最小可動）。weightsは後で学習値に更新可能（0..1）。

const IDEALS = ['leader','liberator','supporter','scholar','artist','guardian','challenger','connector','charisma','builder','reformer','healer'];

const base = (id, label, blurb) => ({
  id, label, blurb,
  weights: IDEALS.reduce((a,k)=> (a[k]=0.5, a), {})
});

export const INDUSTRY_24 = [
  base('entrepreneur','起業・経営','裁量と責任が大きく、意思決定の速さが武器になります。'),
  base('education','教育・指導','成長を支える関わりが成果に直結します。'),
  base('medical','医療・福祉','生活に近い実感と貢献が評価されます。'),
  base('art','アート・デザイン','独自性と世界観が価値になります。'),
  base('entertain','エンタメ・表現','感情を動かす体験設計が鍵です。'),
  base('science','科学・研究','仮説検証と再現性が成果の基準です。'),
  base('sales','ビジネス・営業','関係構築と提案力が成果を左右します。'),
  base('planning','企画・商品開発','情報統合と試作による学びが進歩を生みます。'),
  base('public','公務・行政','公平性と継続運用が重視されます。'),
  base('finance','金融・会計','正確性と信頼が基盤です。'),
  base('it','IT・テクノロジー','抽象と具体の橋渡しが価値になります。'),
  base('manufact','ものづくり・工学','品質と工程管理が成果を支えます。'),
  base('pr','広報・コミュニケーション','ストーリー化と信頼獲得が武器になります。'),
  base('agri','農業・自然・環境','循環視点と継続の工夫が必要です。'),
  base('hospitality','観光・ホスピタリティ','気づきと段取りが体験の質を決めます。'),
  base('sports','スポーツ・身体表現','習慣と自己更新が伸びを生みます。'),
  base('legal','司法・法律','論理の精度とバランス感覚が肝です。'),
  base('writing','ライティング・出版','言語化と編集が核です。'),
  base('spiritual','宗教・哲学・スピリチュアル','価値観の探究と安全な場づくりが鍵です。'),
  base('fashion','ファッション・美容','審美眼と提案が価値になります。'),
  base('game-film','ゲーム・映像・制作','チーム連携と反復制作が成果を押し上げます。'),
  base('global','国際・グローバル','多様性の理解と交渉力が求められます。'),
  base('food','食・サービス','オペの安定と体験設計が両輪です。'),
  base('social','スタートアップ・社会起業','課題発見と実装力が直結します。')
];

export default INDUSTRY_24;