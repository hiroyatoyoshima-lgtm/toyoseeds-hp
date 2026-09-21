---
name: shachonikki
description: ToyoSeedsの社長日記を書いて公開する。音声の書き起こしやメモを渡されたときに、記事の推敲・作成・サイト更新・note用テキストの書き出しまでを行う。「日記書いて」「今日のテーマは○○」「ブログにして」と言われたら使う。
---

# 社長日記を書く

トヨ（豊島）が話した内容を、社長日記の記事にして公開するための手順。

## 1. まず素材を読む

渡されるのは音声の書き起こしが多い。誤変換だらけなので、文意から復元する。
判断に迷う固有名詞や数字は、勝手に決めずに確認する。

## 2. 文体ルール

過去の記事（`shachonikki_day29` 以降が今の文体）に合わせる。

**やること**
- 一人称は「僕」
- 短い文を改行で重ねる。1段落は2〜5行
- ただし**短ければいいわけではない**。優先は「伝わるか」と「リズム」。字数を削るために接続を落とさない
- 「けど」「だから」「〜してしまえば」を残す。文は最後まで書き切る
- 語尾をゆるめる。「たぶん」「なんとなく」「〜な気がしている」「〜で終わってしまう」。トヨの文の温かみはここから出ている。断定だけを並べると冷たくなる
- 補足は括弧書きで短く（例:「（赤点とは、30点以下のこと）」）
- **ほかの記事へのリンクは、リンクのテキストに必ずその記事のタイトルをそのまま入れる。**
  書き方は括弧で添える: `20日目に、noteを始めた。（[vol56 ペルソナ](/shachonikki_day56/)）`
  「こちら」「この記事」「16日目の日記」のような書き方はしない。
  読者はどこに飛ばされるか分からないと押せない
- 会話や心の声はカギ括弧でそのまま置く
- 事実（点数、順位、日付）は書き起こしのとおりに。盛らない
- オチで終わる。可笑しみか、余韻のどちらか

**やらないこと**
- 「こんにちは、ToyoSeeds社長の豊島です」のような挨拶で始めない（vol28以前の古い型）
- 「今日のテーマは○○」で始めない
- 教訓・学び・まとめで終わらせない。「〜だと思う」「〜が大事だ」「仕事も同じ」は書かない
   → トヨはこれを一番嫌がる。読者に説明せず、事実とオチだけ置いて終わる
- 事実を膨らませたり、言っていないエピソードを足したりしない
- **時系列を混ぜない。** 「昔はこうだった → 今はこう」は、その順に、日付と本数で並べる。
   途中に過去記事からの引用や寄り道を挟むと、読者はどっちの話か分からなくなる
- 体言止めを並べて決めにいかない。「稼ぐ、の一点しか見ていなかった」「ニューヨークのスーツと、紀元前の戦場」のような、接続を落とした対句はコピーの文体であってトヨの文ではない
   → 読み手が関係を自分で補わされる。標語としては読めても、日記としては読めない

**長さの目安**
- エピソード型（過去の話）: 700〜1,200字
- 気づき型（比喩・言葉から広げる）: 300〜450字
- つなぎ型（近況・短い記録）: 60〜200字

## 3. 記事を作る

本文をテキストファイルに書いてから、スクリプトで流し込む。

```bash
python3 scripts/new_post.py --title "ベクトル" --body draft.txt --tag "#勉強法" --tag-en "#HowIStudy" --title-en "Vectors" --body-en draft_en.txt
python3 scripts/new_post.py --title "ベクトル" --body draft.txt --tag "#勉強法" --tag-en "#HowIStudy" --title-en "Vectors" --body-en draft_en.txt --dry-run
```

`--tag` は記事末尾のハッシュタグ。**1記事につき1〜2つ**。毎回変える
（全記事に同じタグが並ぶと、タグから記事を探せない）。**毎回新しいタグを作らず、次の10カテゴリから選ぶ**:
`#ピアノ` `#AI` `#日記` `#SeedsStay` `#つながるBAR` `#経営` `#習慣` `#チーム` `#昔の話` `#目標`
（どれにも入らない記事が続くようなら、そのときカテゴリを足す。1本のために増やさない）
英語表示のときだけ変えたいなら `--tag-en "#HowIStudy"`。台帳は `scripts/tags.json`。

vol番号・日付（既定は今日）・前後記事のリンクは自動。
これ1本で5か所（記事／news一覧／トップのNews欄／sitemap／前の記事のナビ）が揃う。
**手作業でHTMLを書き足さない。** 抜けが出る。

本文ファイルの書き方は `scripts/new_post.py` の冒頭を参照。空行で段落、段落内の改行はそのまま改行。
過去記事へのリンクは `[16日目の日記](/shachonikki_day52/)` と書く（HTMLを直に書かない。英訳のほうにも同じ位置で入れる）。
補足を灰色の囲みにするときは `[box]` と `[/box]` の行ではさむ。

### 英訳を必ず付ける

サイトは EN 切り替えに対応していて、**記事は本文まで英語で読める**。
新しい記事にも毎回、日本語の下書きと一緒に英訳（`draft_en.txt`）を作って、
上のコマンドの `--title-en` / `--body-en` で一緒に流し込む。

- 英訳の方針は**自然な英語優先**。日本語の改行やリズムをそのまま写さず、英語として読みやすい形に寄せる
- 段落の区切り（空行）は日本語版と合わせる。画像の `[img ...]` も同じ位置に置く
- 固有名詞は既存記事に合わせる（つながるBAR → Tsunagaru BAR、民泊/宿 → guesthouse、社長日記 → CEO Diary）
- 英訳を忘れて公開してしまったら、あとから足せる:
  `python3 scripts/add_translation.py 66 --title "Vectors" --body draft_en.txt`
- トヨのマシン（python が動かない）では `node scripts/new_post.mjs` に同じ `--title-en` / `--body-en` を付ける

仕組みの詳細は `CLAUDE.md` の「英語切り替え」を参照。

### 画像

写真を渡されたら取り込む。余白のトリミングは事前に済ませておくと見栄えがいい。

```bash
python3 scripts/new_post.py --title "ベクトル" --body draft.txt --tag "#勉強法" --image ~/photo.jpg --image-name report-card.jpg
```

本文の中で、入れたい位置に次の1行を単独で置く:

```
[img report-card.jpg | 高校2年の通知表。左の「評価」が100点満点、右の「評定」が5段階評価。 | 高校2年の通知表]
```

キャプションは説明に使い、笑いどころは本文側に置く。

### 見出し画像（note用 thumb.jpg）は Codex に描かせる

note の見出し画像は記事フォルダの `thumb.jpg`（1280×670）。**写真背景＋白ゴシックの見出し1本（小見出し無し）**の型（2026-09-15 トヨ確定。見本は `note-thumbnails\day57.png`）を **Codex の画像生成**（VS Code 拡張に同梱の `codex exec`。トヨの ChatGPT プラン内・API キー不要・1枚あたりの費用ゼロ）で作る。
記事を push した後、Claude Code が記事を読んで「見出し（日本語・画像にそのまま出る。`|` で改行位置）」「記事の真実（英語）」「写真の場面（英語・人物なし）」を書き、これを回す:

```powershell
.\scripts\codex_thumb.ps1 -Day 57 -Headline "地元を離れて、|出身地が変わった。" -Truth "English: what the article says, and what must NOT be implied." -Scene "English: the photographic background (place, objects, light). No people, no signs."
```

1本で「Codex 生成 → 1280×670 JPEG → thumb.jpg を commit/push → open の note 起票 Issue の『見出し画像』行を URL に書き換え」まで進む。**5〜35 分かかる**のでバックグラウンドで回し、終わったらトヨに「Chrome どうぞ」と伝える。
- 文面の型は `note-thumbnails\day56-prompt.txt`（Codex が最初に作った回）。テンプレは `scripts/codex_thumb_prompt.txt`
- `-DryRun` でプロンプトだけ確認、`-NoPush` で生成と変換まで、`-FromPng <png>` で手持ちの画像から変換・push・Issue だけ
- Codex 本体は `%USERPROFILE%\.vscode\extensions\openai.chatgpt-*\bin\windows-x86_64\codex.exe`（拡張の更新でフォルダ名が変わる。スクリプトが最新を探す）
- Toyo のマシンは python が動かないので、記事の 5 か所更新は `node scripts/new_post.mjs`（同じ引数。`--title-en` / `--body-en` も使える）

## 4. 公開する

サイトは `main` にプッシュすると Vercel が自動デプロイする。作業ブランチのままだと公開されない。

```bash
git add -A && git commit -m "vol56: タイトル（2026.09.10）" && git push origin main
```

公開先: `https://www.toyoseeds.com/shachonikki_dayNN/`

## 5. note用のテキストを出す

社長日記は自社サイトが元記事、noteは全文転載の配信チャネル。

```bash
python3 scripts/export_note.py 56
```

1行目がタイトル、以降が本文、末尾に元記事と会社へのリンクが入った状態で出る。
`［画像：…］` の行はnote側で画像に差し替える（アップロードするファイルのパスは標準エラー側に出る）。

**検索流入を狙っている記事（`mimpaku_buy-list` など）はnoteに全文転載しない。**

### 公開したあとは自動で「note起票」される

`main` に新しい `shachonikki_dayNN/index.html` が増えると、GitHub Actions（`.github/workflows/note-kihyo.yml`）が
Issue「note起票: volNN タイトル」（ラベル `note`）を立てる。本文は上の export_note.py の出力＋手順。
投稿は トヨが Claude in Chrome に「ラベル note の open Issue を古い順に note へ」と指示して行い、Chrome 側が
公開URLをコメントして Issue を閉じる。**この手順で手作業は「Chrome に一言」だけ**。

- 記事を書き直しても Issue は増えない（追加された記事だけ拾う）。note 側の直しは Chrome に頼む
- 手動で起票したいとき: Actions の「note起票」→ Run workflow → vol 番号
- 台帳（どの vol がいつ note に載ったか）は ToyoSeeds 側 `/note-tensai --sync` が note の公開APIから自動で付ける

## 6. 書き直しを頼まれたら

公開後の修正はよくある。該当ファイルを直して `main` にプッシュし直すだけ。
削除を頼まれた部分は、言い換えではなく本当に消す。
