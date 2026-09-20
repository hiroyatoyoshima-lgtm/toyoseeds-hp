#!/usr/bin/env python3
"""記事に英訳（EN切り替え用の data-en）を入れる。

使い方:
    python3 scripts/add_translation.py 66 --title "English title" --body en.txt
    python3 scripts/add_translation.py 66 --title "English title" --body en.txt --dry-run
    python3 scripts/add_translation.py --slug goma-diary/vol5 --title "..." --body en.txt

en.txt の書き方は new_post.py の body と同じ:
    - 空行で段落を区切る（<p> になる）
    - 段落内の改行はそのまま改行になる（<br> になる）
    - 画像は日本語版と同じ位置に [img ファイル名 | キャプション | alt文] を置く

更新する箇所:
    1. 記事本体          … <title> / meta / <h1> / 本文に data-en を入れる
    2. news/index.html   … 一覧のタイトル
    3. index.html        … トップの News 欄（最新4件に入っていれば）
    4. goma-diary/index.html … 社員日記の一覧（社員日記のとき）
    5. 前後の記事        … 「前の記事 / 次の記事」ナビのタイトル
"""
import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parents[1]


def attr(value):
    """data-en に入れる。タグは生かしたいので & と " だけ逃がす。"""
    return value.replace("&", "&amp;").replace('"', "&quot;")


def set_attr(html, pattern, name, value, label, changes, required=True):
    """pattern の1件目に name="value" を足す（すでにあれば置き換える）。"""
    m = re.search(pattern, html)
    if not m:
        if required:
            sys.exit(f"[中止] {label} が見つかりませんでした")
        return html
    tag = m.group(0)
    new_tag = re.sub(r'\s' + re.escape(name) + r'="[^"]*"', "", tag)
    insert = f' {name}="{attr(value)}"'
    new_tag = new_tag[: new_tag.index(">")] + insert + new_tag[new_tag.index(">") :]
    if new_tag != tag:
        changes.append(label)
    return html[: m.start()] + new_tag + html[m.end() :]


def find_wp_content(html):
    """<div class="wp-content"> の開始タグの範囲を返す（入れ子の div があるので手で数える）。"""
    m = re.search(r'<div class="wp-content"[^>]*>', html)
    if not m:
        sys.exit("[中止] 本文（wp-content）が見つかりませんでした")
    return m


def apply_translation(slug, title_en, body_en, dry_run=False):
    """記事と一覧・前後ナビに data-en を入れる。変更した箇所の一覧を返す。"""
    from new_post import plain_text  # 同じ整形を使う

    page = ROOT / slug / "index.html"
    desc = plain_text(body_en)
    desc = (desc[:150] + "…") if len(desc) > 150 else desc
    changes = []
    html = page.read_text(encoding="utf-8")

    if "assets/i18n.js" not in html:
        up = "../../" if "/" in slug else "../"
        html = html.replace(
            'content-v2.css">', f'content-v2.css">\n<script src="{up}assets/i18n.js" defer></script>', 1
        )
        changes.append(f"{slug}: i18n.js を読み込み")

    html = set_attr(html, r"<title>[\s\S]*?</title>|<title [^>]*>[\s\S]*?</title>",
                    "data-en", f"{title_en} | ToyoSeeds LLC", f"{slug}: <title>", changes)
    html = set_attr(html, r'<meta name="description"[^>]*>',
                    "data-en-content", desc, f"{slug}: meta description", changes)
    html = set_attr(html, r'<meta property="og:title"[^>]*>',
                    "data-en-content", f"{title_en} | ToyoSeeds LLC", f"{slug}: og:title", changes)
    html = set_attr(html, r'<meta property="og:description"[^>]*>',
                    "data-en-content", desc, f"{slug}: og:description", changes)
    html = set_attr(html, r"<h1[^>]*>", "data-en", title_en, f"{slug}: <h1>", changes)

    m = find_wp_content(html)
    html = set_attr(html, re.escape(m.group(0)), "data-en", body_en, f"{slug}: 本文", changes)

    if not dry_run:
        page.write_text(html, encoding="utf-8")

    # --- 一覧ページと前後ナビのタイトル ---
    def patch_link_title(path, pattern, label):
        p = ROOT / path
        if not p.exists():
            return
        s = p.read_text(encoding="utf-8")
        hit = re.search(pattern, s)
        if not hit:
            return
        tag = hit.group(1)
        new_tag = re.sub(r'\sdata-en="[^"]*"', "", tag)
        new_tag = new_tag[:-1] + f' data-en="{attr(title_en)}">'
        if new_tag != tag:
            changes.append(label)
            s = s[: hit.start(1)] + new_tag + s[hit.end(1) :]
            if not dry_run:
                p.write_text(s, encoding="utf-8")

    esc_slug = re.escape(slug)
    patch_link_title("news/index.html",
                     rf'<a class="news-list-row" href="/{esc_slug}/">[\s\S]*?(<strong[^>]*>)',
                     "news/index.html: 一覧のタイトル")
    patch_link_title("index.html",
                     rf'<a class="news-row" href="/{esc_slug}/"[\s\S]*?(<span style="font-size:17\.4px;font-weight:600"[^>]*>)',
                     "index.html: トップのNews欄")
    if slug.startswith("goma-diary/"):
        patch_link_title("goma-diary/index.html",
                         rf'<a class="news-list-row" href="/{esc_slug}/">[\s\S]*?(<strong[^>]*>)',
                         "goma-diary/index.html: 一覧のタイトル")

    # 他の記事の「前の記事 / 次の記事」ナビ
    for other in sorted(ROOT.glob("*/index.html")) + sorted(ROOT.glob("goma-diary/*/index.html")):
        s = other.read_text(encoding="utf-8")
        if f'href="/{slug}/"><small' not in s:
            continue
        hit = re.search(rf'href="/{esc_slug}/"><small[^>]*>[^<]*</small>(<strong[^>]*>)', s)
        if not hit:
            continue
        tag = hit.group(1)
        new_tag = re.sub(r'\sdata-en="[^"]*"', "", tag)
        new_tag = new_tag[:-1] + f' data-en="{attr(title_en)}">'
        if new_tag != tag:
            rel = other.parent.relative_to(ROOT)
            changes.append(f"{rel}: 前後ナビのタイトル")
            s = s[: hit.start(1)] + new_tag + s[hit.end(1) :]
            if not dry_run:
                other.write_text(s, encoding="utf-8")

    return changes


def main():
    ap = argparse.ArgumentParser(description="記事に英訳を入れる")
    ap.add_argument("vol", nargs="?", type=int, help="社長日記の vol 番号")
    ap.add_argument("--slug", help="vol 以外の記事（例 goma-diary/vol5）")
    ap.add_argument("--title", required=True, help="英語のタイトル（vol番号は自動で付く）")
    ap.add_argument("--body", required=True, help="英訳した本文のテキストファイル")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.slug and args.vol is None:
        ap.error("vol 番号か --slug のどちらかを指定してください")
    slug = args.slug or f"shachonikki_day{args.vol}"
    page = ROOT / slug / "index.html"
    if not page.exists():
        sys.exit(f"[中止] {slug}/index.html がありません")

    title_en = args.title.strip()
    if args.vol is not None and not args.slug and not title_en.lower().startswith("vol"):
        title_en = f"vol{args.vol} {title_en}"

    from new_post import build_body as _bb  # 同じ本文変換を使う
    body_en = _bb(Path(args.body).read_text(encoding="utf-8"), slug)
    changes = apply_translation(slug, title_en, body_en, args.dry_run)

    head = "変更予定（--dry-run なので書き込みません）" if args.dry_run else "英訳を入れました"
    print(f"{slug}「{title_en}」… {head}")
    for c in changes:
        print(f"  - {c}")
    if not changes:
        print("  （変更なし）")


if __name__ == "__main__":
    main()
