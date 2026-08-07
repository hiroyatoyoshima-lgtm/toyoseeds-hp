# Gmail問い合わせ送信の設定

このフォルダーの `Code.gs` をGoogle Apps Scriptへ登録すると、ToyoSeedsのGmailから次の2通を送信します。

1. `hiroyatoyoshima@toyoseeds.com` への問い合わせ通知
2. 問い合わせ送信者への受付完了メール

## Google側の設定

1. `https://script.google.com/` を開き、「新しいプロジェクト」を作成
2. エディタの内容を削除し、`Code.gs` の内容を貼り付けて保存
3. 左側の「プロジェクトの設定」を開く
4. 「スクリプト プロパティ」に次を追加
   - `CONTACT_TO_EMAIL`: `hiroyatoyoshima@toyoseeds.com`
   - `CONTACT_SECRET`: Vercelにも登録する長いランダム文字列
5. 右上の「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
6. 「次のユーザーとして実行」は自分
7. 「アクセスできるユーザー」は全員
8. 初回だけGmail送信権限を許可
9. 発行された `/exec` で終わるウェブアプリURLを保存

## Vercel側の環境変数

- `GOOGLE_APPS_SCRIPT_URL`: 手順9で発行されたURL
- `CONTACT_SHARED_SECRET`: Google側の `CONTACT_SECRET` と同じ文字列

`CONTACT_SECRET` はHTMLやGitHubへ書かず、GoogleのスクリプトプロパティとVercelの環境変数だけに保存します。

コードを変更した場合は、Apps Scriptの「デプロイを管理」から新しいバージョンとして更新します。
