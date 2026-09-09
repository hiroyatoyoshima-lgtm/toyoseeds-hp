#!/usr/bin/env python3
"""社長日記の新規記事を作成し、サイト内の関連箇所をまとめて更新する。

使い方:
    python3 scripts/new_post.py --title "ベクトル" --body draft.txt
    python3 scripts/new_post.py --title "ベクトル" --body draft.txt --date 2026-09-10 --dry-run
    python3 scripts/new_post.py --title "ベクトル" --body draft.txt --image ~/photo.jpg

body ファイルの書き方:
    - 空行で段落を区切る（<p> になる）
    - 段落内の改行はそのまま改行として表示される（<br> になる）
    - 画像を入れたい位置に次の1行を単独で置く:
        [img ファイル名 | キャプション | alt文]
      ファイル名は --image で取り込んだ後の記事内ファイル名（既定 photo.jpg）

更新する箇所（5か所）:
    1. shachonikki_dayNN/index.html  … 記事本体
    2. news/index.html               … 日記・お知らせ一覧の先頭
    3. index.html                    … トップの News 欄（最新4件を維持）
    4. sitemap.xml                   … URL を追加
    5. 1つ前の記事                    … 「次の記事 →」ナビを追加
"""
import argparse
import datetime
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.toyoseeds.com"
TOP_NEWS_ROWS = 4  # トップの News 欄に残す件数

ARTICLE = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>vol{vol} {title}｜ToyoSeeds合同会社</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{base}/{slug}/">
<meta property="og:type" content="article">
<meta property="og:title" content="vol{vol} {title}｜ToyoSeeds合同会社">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{base}/{slug}/">
<meta property="og:image" content="{base}/assets/og-image-v3.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../assets/content-v2.css">
</head>
<body>
<header class="content-header">
  <a class="brand" href="/">Toyo<span>Seeds</span></a>
  <nav aria-label="主要メニュー">
    <a href="/">ホーム</a><a href="/news/">News</a><a href="/#company">会社概要</a><a class="nav-contact" href="/contact/">お問い合わせ</a>
  </nav>
</header>
<main class="article-shell">
  <a class="back-link" href="/news/">← News一覧へ</a>
  <article class="article-card">
    <header class="article-title">
      <span class="category">社長日記</span>
      <time datetime="{iso}">{dot}</time>
      <h1>vol{vol} {title}</h1>
    </header>
    <div class="wp-content">{body}</div>
    <div class="post-like">
      <button type="button" class="like-btn" data-slug="{slug}" aria-pressed="false" aria-label="スキ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.3 4.8 6.6 4.5c2-.2 3.7.8 4.6 2.3 1-1.5 2.7-2.5 4.7-2.3 3.3.3 5.2 3.5 3.9 6.8-1.8 4.6-7.8 9.2-7.8 9.2z"/></svg>スキ</button>
      <span class="like-count" aria-live="polite"></span>
    </div>
  </article>
  <aside class="post-cta">
    <p>ToyoSeeds合同会社は、福岡でAI・データ活用と、宿泊・インバウンドの2つの事業をやっています。</p>
    <a href="/#services">ToyoSeedsの事業を見る →</a>
  </aside>
  <nav class="article-nav" aria-label="記事の前後移動"><a href="/{prev_slug}/"><small>← 前の記事</small><strong>{prev_title}</strong></a></nav>
  <a class="button" href="/news/">社長日記・お知らせ一覧へ</a>
</main>
<footer class="content-footer">
  <a class="brand brand--footer" href="/">Toyo<span>Seeds</span></a>
  <div><a href="/privacy-policy/">プライバシーポリシー</a><span>© ToyoSeeds LLC.</span></div>
</footer>
<script defer src="/likes.js"></script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
"""

TOP_ROW = """      <a class="news-row" href="/{slug}/" style="display:grid;grid-template-columns:130px 110px 1fr;gap:24px;align-items:baseline;padding:22px 8px;border-top:1px solid #DDE1EA;color:#1A2142" style-hover="background:#F7F8FB;color:var(--c-primary)">
        <span style="font-size:15.2px;color:#5A6180;font-variant-numeric:tabular-nums">{dot}</span>
        <span style="font-size:12.9px;font-weight:800;letter-spacing:.1em;color:var(--c-tag-ink);background:var(--c-tag-bg);border-radius:999px;padding:4px 12px;text-align:center">社長日記</span>
        <span style="font-size:17.4px;font-weight:600">vol{vol} {title}</span>
      </a>
"""


def esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def latest_vol():
    """既存の shachonikki_dayNN から最大の番号を返す。"""
    nums = [int(m.group(1)) for p in ROOT.glob("shachonikki_day*")
            if (m := re.fullmatch(r"shachonikki_day(\d+)", p.name)) and p.is_dir()]
    return max(nums)


def article_title(slug):
    html = (ROOT / slug / "index.html").read_text(encoding="utf-8")
    return re.search(r"<h1>(.*?)</h1>", html, re.S).group(1).strip()


def image_size(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def build_body(text, slug):
    """本文テキストを wp-content 用の HTML にする。"""
    blocks = []
    for raw in re.split(r"\n\s*\n", text.strip()):
        block = raw.strip()
        if not block:
            continue
        m = re.fullmatch(r"\[img\s+([^|\]]+?)\s*(?:\|\s*([^|\]]*?)\s*)?(?:\|\s*([^\]]*?)\s*)?\]", block)
        if m:
            name, caption, alt = m.group(1), (m.group(2) or "").strip(), (m.group(3) or "").strip()
            src = f"/{slug}/{name}"
            size = image_size(ROOT / slug / name)
            dims = f' width="{size[0]}" height="{size[1]}"' if size else ""
            cap = f"<figcaption>{esc(caption)}</figcaption>" if caption else ""
            blocks.append(
                f'<figure class="wp-block-image size-full">'
                f'<img src="{src}" alt="{esc(alt or caption)}"{dims} loading="lazy">{cap}</figure>'
            )
            continue
        lines = [esc(line.strip()) for line in block.split("\n") if line.strip()]
        blocks.append("<p>" + "<br>\n".join(lines) + "</p>")
    return "\n\n".join(blocks)


def plain_text(body_html):
    text = re.sub(r"<figure.*?</figure>", "", body_html, flags=re.S)
    text = re.sub(r"<br>\s*", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def replace_once(path, old, new, changes, dry_run):
    p = ROOT / path
    s = p.read_text(encoding="utf-8")
    if s.count(old) != 1:
        sys.exit(f"[中止] {path} に想定した箇所が {s.count(old)} 件見つかりました（1件のはず）")
    changes.append(path)
    if not dry_run:
        p.write_text(s.replace(old, new, 1), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True, help='タイトル（"vol56 " は自動で付く）')
    ap.add_argument("--body", required=True, help="本文テキストファイル")
    ap.add_argument("--date", help="公開日 YYYY-MM-DD（既定: 今日）")
    ap.add_argument("--vol", type=int, help="vol番号（既定: 最新+1）")
    ap.add_argument("--desc", help="meta description（既定: 本文の冒頭から自動生成）")
    ap.add_argument("--image", help="記事に入れる画像ファイル。記事フォルダに取り込む")
    ap.add_argument("--image-name", default="photo.jpg", help="取り込み後のファイル名（既定 photo.jpg）")
    ap.add_argument("--max-width", type=int, default=700, help="画像の最大幅（既定 700px）")
    ap.add_argument("--dry-run", action="store_true", help="書き込まずに変更予定だけ表示")
    args = ap.parse_args()

    vol = args.vol or latest_vol() + 1
    slug = f"shachonikki_day{vol}"
    prev_slug = f"shachonikki_day{vol - 1}"
    if (ROOT / slug).exists() and not args.vol:
        sys.exit(f"[中止] {slug} はすでに存在します")
    if not (ROOT / prev_slug).exists():
        sys.exit(f"[中止] 1つ前の記事 {prev_slug} が見つかりません")

    date = datetime.date.fromisoformat(args.date) if args.date else datetime.date.today()
    iso, dot = date.isoformat(), date.strftime("%Y.%m.%d")
    title = args.title.strip()
    changes = []

    # 画像の取り込み（縮小して記事フォルダへ）
    if args.image:
        src = Path(args.image).expanduser()
        if not src.exists():
            sys.exit(f"[中止] 画像が見つかりません: {src}")
        dest = ROOT / slug / args.image_name
        if not args.dry_run:
            dest.parent.mkdir(parents=True, exist_ok=True)
            try:
                from PIL import Image
                with Image.open(src) as im:
                    im = im.convert("RGB")
                    im.thumbnail((args.max_width, args.max_width * 8))
                    im.save(dest, quality=82, optimize=True, progressive=True)
            except ImportError:
                shutil.copy(src, dest)
        changes.append(f"{slug}/{args.image_name}")

    body_html = build_body(Path(args.body).read_text(encoding="utf-8"), slug)
    desc = args.desc or (plain_text(body_html)[:110] + "…")

    # 1. 記事本体
    article = ARTICLE.format(vol=vol, title=esc(title), desc=esc(desc), base=BASE, slug=slug,
                             iso=iso, dot=dot, body=body_html,
                             prev_slug=prev_slug, prev_title=esc(article_title(prev_slug)))
    changes.append(f"{slug}/index.html")
    if not args.dry_run:
        (ROOT / slug).mkdir(exist_ok=True)
        (ROOT / slug / "index.html").write_text(article, encoding="utf-8")

    # 2. news 一覧の先頭に追加
    replace_once("news/index.html", '<div class="news-list">',
                 f'<div class="news-list"><a class="news-list-row" href="/{slug}/">'
                 f'<time datetime="{iso}">{dot}</time><span class="category">社長日記</span>'
                 f'<strong>vol{vol} {esc(title)}</strong></a>', changes, args.dry_run)

    # 3. トップの News 欄（先頭に追加して古いものを落とす）
    top = ROOT / "index.html"
    s = top.read_text(encoding="utf-8")
    rows = list(re.finditer(r'      <a class="news-row" href="/[^"]+/"[\s\S]*?\n      </a>\n', s))
    if not rows:
        sys.exit("[中止] トップの News 欄が見つかりません")
    s = s[:rows[0].start()] + TOP_ROW.format(slug=slug, dot=dot, vol=vol, title=esc(title)) + s[rows[0].start():]
    rows = list(re.finditer(r'      <a class="news-row" href="/[^"]+/"[\s\S]*?\n      </a>\n', s))
    for extra in reversed(rows[TOP_NEWS_ROWS:]):
        s = s[:extra.start()] + s[extra.end():]
    changes.append("index.html")
    if not args.dry_run:
        top.write_text(s, encoding="utf-8")

    # 4. sitemap
    replace_once("sitemap.xml", "</urlset>",
                 f"  <url><loc>{BASE}/{slug}/</loc></url>\n</urlset>", changes, args.dry_run)

    # 5. 1つ前の記事に「次の記事 →」を足す
    prev_html = (ROOT / prev_slug / "index.html").read_text(encoding="utf-8")
    if "次の記事" in prev_html:
        print(f"[skip] {prev_slug} にはすでに次の記事リンクがあります")
    else:
        replace_once(f"{prev_slug}/index.html", "</a></nav>",
                     f'</a><a href="/{slug}/"><small>次の記事 →</small>'
                     f'<strong>vol{vol} {esc(title)}</strong></a></nav>', changes, args.dry_run)

    head = "変更予定（--dry-run なので書き込みません）" if args.dry_run else "更新しました"
    print(f"vol{vol} {title}（{dot}）… {head}")
    for c in changes:
        print(f"  - {c}")
    if not args.dry_run:
        print(f"\n確認: {BASE}/{slug}/")
        print(f"note用テキスト: python3 scripts/export_note.py {vol}")


if __name__ == "__main__":
    main()
