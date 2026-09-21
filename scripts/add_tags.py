#!/usr/bin/env python3
"""記事の末尾のハッシュタグ（.post-tags）を scripts/tags.json のとおりに入れ直す。

1記事につき1つ。同じタグが並ぶと記事を探せないので、記事ごとに変えている。
すでに入っている記事は中身を差し替えるだけなので、何度流しても増えない。

    python3 scripts/add_tags.py           # 全記事に反映
    python3 scripts/add_tags.py --check   # 差分だけ見る（書き込まない）
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
TAGS = ROOT / "scripts" / "tags.json"
BLOCK = re.compile(r'[ \t]*<div class="post-tags".*?</div>\n?', re.S)


def block(tag):
    """タグ1つ。押すと /tags/ のそのタグの場所に飛ぶ。"""
    en = f' data-en="{tag["en"]}"' if tag["en"] != tag["ja"] else ""
    href = "/tags/#tag-" + tag["ja"].lstrip("#")
    return (f'    <div class="post-tags" aria-label="ハッシュタグ">'
            f'<a href="{href}"{en}>{tag["ja"]}</a></div>\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="書き込まずに結果だけ出す")
    args = ap.parse_args()

    tags = {k: v for k, v in json.loads(TAGS.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    changed = same = 0
    for slug, tag in tags.items():
        path = ROOT / slug / "index.html"
        if not path.exists():
            sys.exit(f"[中止] 記事が見つかりません: {slug}/index.html")
        html = path.read_text(encoding="utf-8")
        new = block(tag)
        if BLOCK.search(html):
            out = BLOCK.sub(lambda _: new, html, count=1)
        else:
            m = re.search(r'[ \t]*<div class="post-like">', html) or re.search(r"[ \t]*</article>", html)
            if not m:
                sys.exit(f"[中止] 入れる場所が見つかりません: {slug}")
            out = html[: m.start()] + new + html[m.start():]
        if out == html:
            same += 1
            continue
        changed += 1
        if not args.check:
            path.write_text(out, encoding="utf-8")
    verb = "書き換える予定" if args.check else "書き換えた"
    print(f"{verb}記事: {changed}本（そのままでよかった: {same}本）")
    if not args.check:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "generate_tags_page.py")], check=True)


if __name__ == "__main__":
    main()
