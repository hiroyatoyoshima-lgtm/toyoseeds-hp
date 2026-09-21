#!/usr/bin/env python3
"""ハッシュタグの一覧ページ `tags/index.html` を作る。

記事末尾のハッシュタグの飛び先。タグごとに、そのタグが付いた記事を並べる。
材料は scripts/tags.json（記事→タグ）と news/index.html（記事の日付・タイトル・区分）。

    python3 scripts/generate_tags_page.py
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://www.toyoseeds.com"
ROW = re.compile(
    r'<a class="news-list-row" href="([^"]+)">'
    r'<time datetime="([^"]+)">([^<]+)</time>'
    r'<span class="category([^"]*)"([^>]*)>([^<]*)</span>'
    r"<strong(.*?)>(.*?)</strong></a>",
    re.S,
)

PAGE = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title data-en="Tags | ToyoSeeds LLC">タグ一覧｜ToyoSeeds合同会社</title>
<meta name="description" data-en-content="Every tag on the ToyoSeeds diaries, and the posts under each one." content="ToyoSeedsの日記についているタグと、その記事の一覧です。">
<link rel="canonical" href="{base}/tags/">
<meta property="og:type" content="website">
<meta property="og:title" data-en-content="Tags | ToyoSeeds LLC" content="タグ一覧｜ToyoSeeds合同会社">
<meta property="og:description" data-en-content="Every tag on the ToyoSeeds diaries, and the posts under each one." content="ToyoSeedsの日記についているタグと、その記事の一覧です。">
<meta property="og:url" content="{base}/tags/">
<meta property="og:image" content="{base}/assets/og-image-v3.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../assets/content-v2.css">
<script src="../assets/i18n.js" defer></script>
</head>
<body>
<header class="content-header">
  <a class="brand" href="/">Toyo<span>Seeds</span></a>
  <nav aria-label="主要メニュー" data-en-aria-label="Main menu">
    <a href="/" data-en="Home">ホーム</a><a href="/news/">News</a><a href="/#company" data-en="Company">会社概要</a><a class="lang-toggle" href="?lang=en" lang="en" data-lang-toggle aria-label="Switch to English">EN</a><a class="nav-contact" href="/contact/" data-en="Contact">お問い合わせ</a>
  </nav>
</header>
<main class="listing-shell">
  <a class="back-link" href="/news/" data-en="← Diary &amp; News">← 日記・お知らせ</a>
  <p class="eyebrow">TAGS</p>
  <h1 data-en="Tags">タグ一覧</h1>
  <p class="lead" data-en="Every tag on the diaries, and the posts under each one.">日記についているタグと、その記事の一覧です。</p>
  <nav class="tag-cloud" aria-label="タグ" data-en-aria-label="Tags">{cloud}</nav>
{groups}</main>
<footer class="content-footer">
  <a class="brand brand--footer" href="/">Toyo<span>Seeds</span></a>
  <div><a href="/privacy-policy/" data-en="プライバシーポリシー">プライバシーポリシー</a><span>© ToyoSeeds LLC.</span></div>
</footer>
<script>
// i18n.js が英語に差し替えると高さが変わってアンカーがずれるので、差し替え後にもう一度合わせる
addEventListener("load", function () {{
  if (!location.hash) return;
  var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (el) el.scrollIntoView();
}});
</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
"""


def anchor(ja):
    return "tag-" + ja.lstrip("#")


def en_attr(ja, en):
    return f' data-en="{html.escape(en, quote=True)}"' if en and en != ja else ""


def main():
    tags = {k: v for k, v in json.loads((ROOT / "scripts" / "tags.json").read_text(encoding="utf-8")).items()
            if not k.startswith("_")}
    news = (ROOT / "news" / "index.html").read_text(encoding="utf-8")
    rows = {}
    order = []
    for href, iso, dot, cat_mod, cat_attr, cat, t_attr, title in ROW.findall(news):
        slug = href.strip("/")
        rows[slug] = (iso, dot, cat_mod, cat_attr, cat, t_attr, title)
        order.append(slug)

    missing = [s for s in tags if s not in rows]
    if missing:
        sys.exit(f"[中止] news/index.html に見つからない記事: {', '.join(missing)}")

    groups = {}
    for slug in order:                      # news は新しい順。その順のまま各タグに入る
        if slug in tags:
            groups.setdefault(tags[slug]["ja"], []).append(slug)

    # 本数の多いタグから。同数なら新しい記事があるほうを先に
    ordered = sorted(groups, key=lambda t: (-len(groups[t]), order.index(groups[t][0])))

    cloud = "".join(
        f'<a href="#{anchor(t)}"{en_attr(t, tags[groups[t][0]]["en"])}>{html.escape(t)}</a>'
        for t in ordered
    )

    out = []
    for t in ordered:
        en = tags[groups[t][0]]["en"]
        items = "".join(
            '<a class="news-list-row" href="/{s}/"><time datetime="{iso}">{dot}</time>'
            '<span class="category{mod}"{cattr}>{cat}</span><strong{tattr}>{title}</strong></a>'.format(
                s=s, iso=rows[s][0], dot=rows[s][1], mod=rows[s][2], cattr=rows[s][3],
                cat=rows[s][4], tattr=rows[s][5], title=rows[s][6])
            for s in groups[t]
        )
        n = len(groups[t])
        out.append(
            f'  <section class="tag-group" id="{anchor(t)}">\n'
            f'    <h2{en_attr(t, en)}>{html.escape(t)}</h2>\n'
            f'    <p class="tag-count" data-en="{n} post{"s" if n > 1 else ""}">{n}本</p>\n'
            f'    <div class="news-list">{items}</div>\n'
            f"  </section>\n"
        )

    (ROOT / "tags").mkdir(exist_ok=True)
    (ROOT / "tags" / "index.html").write_text(
        PAGE.format(base=BASE, cloud=cloud, groups="".join(out)), encoding="utf-8")
    print(f"tags/index.html を作りました（タグ {len(ordered)}／記事 {len(tags)}）")


if __name__ == "__main__":
    main()
