# ToyoSeeds コーポレートサイト

静的HTMLのサイト。ビルド工程はない。`main` にプッシュすると Vercel が自動デプロイする。
公開URL: https://www.toyoseeds.com/

## 構成

| パス | 中身 |
|---|---|
| `index.html` | トップページ（事業紹介・代表プロフィール・News欄・会社概要） |
| `news/index.html` | 日記・お知らせの全記事一覧 |
| `shachonikki_dayNN/` | 社長日記。`sahchonikki_`（綴り違い）はday1〜20の旧フォルダ |
| `goma-diary/` | 社員日記 |
| `assets/content-v2.css` | 記事ページ共通のスタイル（末尾に「スキ」ボタンのスタイル） |
| `likes.js` / `api/like.mjs` | 社長日記の「スキ」♡。件数の台帳は Google Apps Script 側のスプレッドシート「社長日記スキ」（`google-apps-script/README.md`） |
| `api/contact.mjs` | お問い合わせフォームの送信（同じ Apps Script へ中継） |
| `assets/i18n.js` | 日本語/英語の切り替え。トップ・お問い合わせ・News一覧に入れている |
| `scripts/` | 記事作成・note書き出し・sitemap生成・過去記事へのスキ一括追加 |

## 記事を追加するとき

**必ず `scripts/new_post.py` を使う。** 記事を1本足すには5か所の更新が必要で、手作業だと抜ける。

```bash
python3 scripts/new_post.py --title "タイトル" --body draft.txt
python3 scripts/export_note.py 56    # note貼り付け用テキスト
```

社長日記の書き方・文体ルールは `.claude/skills/shachonikki/SKILL.md` にある。

## 記事ページの決まり

- 本文は `<div class="wp-content">` の中。段落は `<p>`、段落内の改行は `<br>`
- 本文の下（`</article>` の直前）に `.post-like`（スキ♡。`new_post.py` が自動で付ける。過去記事は `node scripts/add-like-button.mjs`）
- 記事カードの下に `.post-cta`（トップの事業紹介への導線）、その下に前後記事ナビ
- 全ページの `</body>` 直前に Vercel Analytics のタグが入っている
- 画像は記事フォルダに置いて `/shachonikki_dayNN/ファイル名` で参照する。横幅700px・JPEG・100KB前後が目安

## 英語切り替え（EN / 日本語）

海外の人向けに、トップ・お問い合わせ・News一覧の3ページを英語で読めるようにしてある。
別ページを作らず、同じHTMLの中身を `assets/i18n.js` が差し替える方式。

- 日本語が入る要素に `data-en="English"` を足すだけで切り替え対象になる（中身はHTMLも可。属性は `data-en-alt` `data-en-content` `data-en-placeholder` `data-en-title` `data-en-aria-label`）
- 片方の言語だけ出したいものは `class="en-only"` / `class="ja-only"`
- 言語の決まり方: URLの `?lang=en` → 前回の選択（localStorage） → ブラウザの言語（日本語以外なら英語）
- **英語は単語の間に空白が要る。** モバイルで `<br>` を `display:none` にしている見出し・段落（ヒーロー、Strengthのh2）は、`data-en` の中で改行の手前に半角スペースを入れる
- JSで出す文言（`assets/contact.js` の送信メッセージ）は `document.documentElement.lang` を見て切り替えている
- 社長日記・社員日記の本文は日本語のまま。記事ページに切り替えボタンは置いていない

トップと一覧のタグ（社長日記）は `scripts/new_post.py` のテンプレートにも `data-en` が入っているので、記事を足しても切り替えは保たれる。

## 気をつけること

- 日付は日本時間で判断する（このセッションのシェルはUTCのことがある）
- トップの News 欄は最新4件だけ。増やさない
- `sitemap.xml` は `scripts/generate_sitemap.py` でも再生成できる
