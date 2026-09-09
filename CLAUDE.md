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
| `assets/content-v2.css` | 記事ページ共通のスタイル |
| `scripts/` | 記事作成・note書き出し・sitemap生成 |

## 記事を追加するとき

**必ず `scripts/new_post.py` を使う。** 記事を1本足すには5か所の更新が必要で、手作業だと抜ける。

```bash
python3 scripts/new_post.py --title "タイトル" --body draft.txt
python3 scripts/export_note.py 56    # note貼り付け用テキスト
```

社長日記の書き方・文体ルールは `.claude/skills/shachonikki/SKILL.md` にある。

## 記事ページの決まり

- 本文は `<div class="wp-content">` の中。段落は `<p>`、段落内の改行は `<br>`
- 本文の下に `.post-cta`（トップの事業紹介への導線）、その下に前後記事ナビ
- 全ページの `</body>` 直前に Vercel Analytics のタグが入っている
- 画像は記事フォルダに置いて `/shachonikki_dayNN/ファイル名` で参照する。横幅700px・JPEG・100KB前後が目安

## 気をつけること

- 日付は日本時間で判断する（このセッションのシェルはUTCのことがある）
- トップの News 欄は最新4件だけ。増やさない
- `sitemap.xml` は `scripts/generate_sitemap.py` でも再生成できる
