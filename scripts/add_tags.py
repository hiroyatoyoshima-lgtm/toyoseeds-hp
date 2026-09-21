#!/usr/bin/env python3
"""日記の全記事に、末尾のハッシュタグ（.post-tags）を入れる。

社長日記は #社長日記、社員日記は #社員日記。ほかの4つは共通。
すでに入っている記事は飛ばすので、何度実行しても増えない。
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

COMMON = [("#SeedsStay", None), ("#ToyoSeeds", None)]
TAIL = [("#福岡", "#Fukuoka"), ("#民泊", "#Guesthouse")]
KIND = {"shacho": ("#社長日記", "#CEODiary"), "goma": ("#社員日記", "#StaffDiary")}


def block(kind):
    tags = COMMON + [KIND[kind]] + TAIL
    spans = "".join(
        f'<span data-en="{en}">{ja}</span>' if en else f"<span>{ja}</span>"
        for ja, en in tags
    )
    return f'    <div class="post-tags" aria-label="ハッシュタグ">{spans}</div>\n'


def targets():
    for p in sorted(ROOT.glob("shachonikki_day*/index.html")) + sorted(
        ROOT.glob("sahchonikki_day*/index.html")
    ):
        yield p, "shacho"
    for p in sorted(ROOT.glob("goma-diary/*/index.html")):
        yield p, "goma"


def main():
    added = skipped = 0
    for path, kind in targets():
        html = path.read_text(encoding="utf-8")
        if 'class="post-tags"' in html:
            skipped += 1
            continue
        m = re.search(r'[ \t]*<div class="post-like">', html) or re.search(
            r"[ \t]*</article>", html
        )
        if not m:
            sys.exit(f"[中止] 入れる場所が見つかりません: {path}")
        path.write_text(html[: m.start()] + block(kind) + html[m.start():], encoding="utf-8")
        added += 1
    print(f"ハッシュタグを入れた記事: {added}本（すでに入っていた: {skipped}本）")


if __name__ == "__main__":
    main()
