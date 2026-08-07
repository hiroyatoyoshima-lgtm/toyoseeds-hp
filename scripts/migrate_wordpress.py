#!/usr/bin/env python3
"""Convert a WordPress WXR export into ToyoSeeds static news pages."""

from __future__ import annotations

import argparse
import html
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


WP = "http://wordpress.org/export/1.2/"
CONTENT = "http://purl.org/rss/1.0/modules/content/"
INTERNAL_ORIGINS = ("https://www.toyoseeds.com", "https://toyoseeds.com")


@dataclass
class Post:
    title: str
    slug: str
    link_path: str
    published: datetime
    modified: datetime
    categories: list[str]
    content: str

    @property
    def label(self) -> str:
        return self.categories[0] if self.categories else "お知らせ"


def text(node: ET.Element, path: str, default: str = "") -> str:
    child = node.find(path)
    return child.text if child is not None and child.text is not None else default


def clean_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    return value or "お知らせ"


def strip_tags(value: str) -> str:
    value = re.sub(r"<!--.*?-->", " ", value, flags=re.S)
    value = re.sub(r"<script\b.*?</script>", " ", value, flags=re.S | re.I)
    value = re.sub(r"<style\b.*?</style>", " ", value, flags=re.S | re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def description(value: str, limit: int = 145) -> str:
    plain = strip_tags(value)
    return plain if len(plain) <= limit else plain[:limit].rstrip() + "…"


def localize_content(value: str) -> str:
    value = re.sub(r"<!--\s*/?wp:.*?-->", "", value, flags=re.S)
    for origin in INTERNAL_ORIGINS:
        value = value.replace(origin + "/", "/")
        value = value.replace(origin, "/")
    value = re.sub(r"<p>\s*</p>", "", value, flags=re.I)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def parse_posts(xml_path: Path) -> list[Post]:
    root = ET.parse(xml_path).getroot()
    posts: list[Post] = []
    for item in root.findall("./channel/item"):
        if text(item, f"{{{WP}}}post_type") != "post":
            continue
        if text(item, f"{{{WP}}}status") != "publish":
            continue
        slug = text(item, f"{{{WP}}}post_name").strip()
        if not slug:
            continue
        link = text(item, "link")
        link_path = urllib.parse.urlparse(link).path or f"/{slug}/"
        categories = [
            (node.text or "").strip()
            for node in item.findall("category")
            if node.attrib.get("domain") == "category" and (node.text or "").strip()
        ]
        posts.append(
            Post(
                title=clean_title(text(item, "title")),
                slug=slug,
                link_path=link_path,
                published=datetime.strptime(text(item, f"{{{WP}}}post_date"), "%Y-%m-%d %H:%M:%S"),
                modified=datetime.strptime(text(item, f"{{{WP}}}post_modified"), "%Y-%m-%d %H:%M:%S"),
                categories=categories,
                content=localize_content(text(item, f"{{{CONTENT}}}encoded")),
            )
        )
    return sorted(posts, key=lambda post: post.published, reverse=True)


def page_head(title: str, summary: str, canonical_path: str) -> str:
    safe_title = html.escape(title)
    safe_summary = html.escape(summary, quote=True)
    canonical = "https://www.toyoseeds.com" + canonical_path
    return f"""<!doctype html>
<html lang=\"ja\">
<head>
<meta charset=\"utf-8\">
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>{safe_title}｜ToyoSeeds合同会社</title>
<meta name=\"description\" content=\"{safe_summary}\">
<link rel=\"canonical\" href=\"{html.escape(canonical, quote=True)}\">
<meta property=\"og:type\" content=\"article\">
<meta property=\"og:title\" content=\"{safe_title}｜ToyoSeeds合同会社\">
<meta property=\"og:description\" content=\"{safe_summary}\">
<meta property=\"og:url\" content=\"{html.escape(canonical, quote=True)}\">
<meta property=\"og:image\" content=\"https://www.toyoseeds.com/assets/og-image-v2.jpg\">
<meta name=\"twitter:card\" content=\"summary_large_image\">
<link rel=\"stylesheet\" href=\"../assets/content-v2.css\">
</head>"""


def header() -> str:
    return """<header class=\"content-header\">
  <a class=\"brand\" href=\"/\">Toyo<span>Seeds</span></a>
  <nav aria-label=\"主要メニュー\">
    <a href=\"/\">ホーム</a><a href=\"/news/\">News</a><a href=\"/#company\">会社概要</a><a class=\"nav-contact\" href=\"/contact/\">お問い合わせ</a>
  </nav>
</header>"""


def footer() -> str:
    return """<footer class=\"content-footer\">
  <a class=\"brand brand--footer\" href=\"/\">Toyo<span>Seeds</span></a>
  <div><a href=\"/privacy-policy/\">プライバシーポリシー</a><span>© ToyoSeeds LLC.</span></div>
</footer>"""


def article_html(post: Post, previous_post: Post | None, next_post: Post | None) -> str:
    body_summary = description(post.content)
    nav_links: list[str] = []
    if previous_post:
        nav_links.append(f'<a href="{html.escape(previous_post.link_path)}"><small>← 前の記事</small><strong>{html.escape(previous_post.title)}</strong></a>')
    if next_post:
        nav_links.append(f'<a href="{html.escape(next_post.link_path)}"><small>次の記事 →</small><strong>{html.escape(next_post.title)}</strong></a>')
    article_nav = "".join(nav_links)
    return f"""{page_head(post.title, body_summary, post.link_path)}
<body>
{header()}
<main class=\"article-shell\">
  <a class=\"back-link\" href=\"/news/\">← News一覧へ</a>
  <article class=\"article-card\">
    <header class=\"article-title\">
      <span class=\"category\">{html.escape(post.label)}</span>
      <time datetime=\"{post.published.date().isoformat()}\">{post.published.strftime('%Y.%m.%d')}</time>
      <h1>{html.escape(post.title)}</h1>
    </header>
    <div class=\"wp-content\">{post.content}</div>
  </article>
  <nav class=\"article-nav\" aria-label=\"記事の前後移動\">{article_nav}</nav>
  <a class=\"button\" href=\"/news/\">社長日記・お知らせ一覧へ</a>
</main>
{footer()}
</body>
</html>
"""


def news_html(posts: list[Post]) -> str:
    rows = []
    for post in posts:
        rows.append(
            f'<a class="news-list-row" href="{html.escape(post.link_path)}">'
            f'<time datetime="{post.published.date().isoformat()}">{post.published.strftime("%Y.%m.%d")}</time>'
            f'<span class="category">{html.escape(post.label)}</span>'
            f'<strong>{html.escape(post.title)}</strong></a>'
        )
    return f"""{page_head('社長日記・お知らせ', 'ToyoSeeds合同会社の社長日記とお知らせです。', '/news/')}
<body>
{header()}
<main class=\"listing-shell\">
  <p class=\"eyebrow\">NEWS</p>
  <h1>社長日記・お知らせ</h1>
  <p class=\"lead\">日々の現場で考えたこと、宿や店づくりの記録をお届けします。</p>
  <div class=\"news-list\">{''.join(rows)}</div>
</main>
{footer()}
</body>
</html>
"""


def media_urls(xml_path: Path) -> list[str]:
    raw = xml_path.read_text(encoding="utf-8")
    found = re.findall(r"https?://(?:www\.)?toyoseeds\.com/wp-content/uploads/[^\s\"'<>\\)]+", raw)
    return sorted({html.unescape(url).rstrip("].,") for url in found})


def write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    posts = parse_posts(args.xml)
    if not posts:
        raise RuntimeError("No published WordPress posts were found")
    for index, post in enumerate(posts):
        previous_post = posts[index + 1] if index + 1 < len(posts) else None
        next_post = posts[index - 1] if index > 0 else None
        directory = urllib.parse.unquote(post.slug)
        write_text(args.out / directory / "index.html", article_html(post, previous_post, next_post))
    write_text(args.out / "news" / "index.html", news_html(posts))
    write_text(args.out / "migration-media-urls.txt", "\n".join(media_urls(args.xml)) + "\n")
    print(f"Generated {len(posts)} published posts and news/index.html", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
